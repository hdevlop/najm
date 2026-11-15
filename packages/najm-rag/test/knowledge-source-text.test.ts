import { describe, test, expect } from 'bun:test';
import { eq } from 'drizzle-orm';
import { KnowledgeService } from '../src/knowledge/KnowledgeService';
import { KnowledgeDocumentService } from '../src/knowledge/KnowledgeDocumentService';
import { ragSchema } from '../src/schema/sqlite';
import { createKnowledgeDb, memoryStorage, fakeEmbedder, createIngestion } from './helpers/knowledgeDb';

const BODY = 'Opening hours are 9 to 5 on weekdays.\n\nThe office is closed on public holidays.';

function knowledgeService(repo: any) {
  return new KnowledgeService(repo, { embed: async () => new Array(768).fill(0.1) } as any, { toolRouting: {} } as any);
}

describe('R3: pasted text is not carried in source metadata', () => {
  test('search results and the document list contain no sourceText, even for old rows', async () => {
    const { sources, knowledge } = await createKnowledgeDb();
    // An old-style row: the body lives in metadata.sourceText.
    await createIngestion(sources, fakeEmbedder()).ingestText({ sourceType: 'text', text: BODY, originalPath: 'text://hours' });

    const found = await knowledgeService(knowledge).search('when are you open', 5, 0);
    expect(found.citations.length).toBeGreaterThan(0);
    for (const citation of found.citations) expect(JSON.stringify(citation.document.metadata ?? {})).not.toContain('sourceText');

    const listed = await new KnowledgeDocumentService(sources).listDocuments();
    expect(JSON.stringify(listed)).not.toContain('sourceText');
  });

  test('with storage, pasted text is saved as a file and metadata holds only its path', async () => {
    const { db, sources } = await createKnowledgeDb();
    const storage = memoryStorage();
    const { documentId } = await createIngestion(sources, fakeEmbedder(), storage)
      .ingestText({ sourceType: 'markdown', text: BODY, originalPath: 'faq.md' });

    const [row] = await db.select().from(ragSchema.chatbotDocumentSources).where(eq(ragSchema.chatbotDocumentSources.id, documentId));
    expect(row.originalPath).toBe('faq.md');
    expect(row.metadata?.sourceText).toBeUndefined();
    expect(row.metadata?.storedPath).toBe(`sources/${documentId}/original.md`);
    expect(storage.files.get(`rag/sources/${documentId}/original.md`)?.toString('utf8')).toBe(BODY);
  });

  test('a stored text document with a label path reindexes, and delete removes only its own file', async () => {
    const { sources } = await createKnowledgeDb();
    const storage = memoryStorage();
    storage.files.set('rag/faq.md', Buffer.from('an unrelated file the app stored'));
    const ingestion = createIngestion(sources, fakeEmbedder(), storage);
    const { documentId, chunks } = await ingestion.ingestText({ sourceType: 'markdown', text: BODY, originalPath: 'faq.md' });

    const reindexed = await ingestion.reindexDocument(documentId);
    expect(reindexed.chunks).toBe(chunks);
    expect(reindexed.embedded).toBe(chunks);

    await new KnowledgeDocumentService(sources, ingestion).deleteDocument(documentId);
    expect(storage.files.has(`rag/sources/${documentId}/original.md`)).toBe(false);
    expect(storage.files.has('rag/faq.md')).toBe(true);
  });

  test('an old-style row (body in metadata) still reindexes', async () => {
    const { sources } = await createKnowledgeDb();
    const ingestion = createIngestion(sources, fakeEmbedder());
    const { documentId, chunks } = await ingestion.ingestText({ sourceType: 'text', text: BODY, originalPath: 'text://hours' });

    const reindexed = await createIngestion(sources, fakeEmbedder(), memoryStorage()).reindexDocument(documentId);
    expect(reindexed.chunks).toBe(chunks);
    expect(reindexed.embedded).toBe(chunks);
  });
});

describe('R4: a failed reindex keeps the existing index', () => {
  test('when every embedding fails, the old chunks and embeddings stay', async () => {
    const { sources } = await createKnowledgeDb();
    let failing = false;
    const ingestion = createIngestion(sources, fakeEmbedder(() => failing));
    const { documentId, chunks } = await ingestion.ingestText({ sourceType: 'text', text: BODY, originalPath: 'text://hours' });
    const before = { chunks: await sources.countChunks(), embeddings: await sources.countEmbeddings() };
    expect(before.embeddings).toBe(chunks);

    failing = true;
    const result = await ingestion.reindexDocument(documentId);

    expect(result.embedded).toBe(0);
    expect({ chunks: await sources.countChunks(), embeddings: await sources.countEmbeddings() }).toEqual(before);
    const source = await sources.getSourceById(documentId);
    expect(source!.status).toBe('failed');
    expect(source!.error).toContain('previous index kept');
  });
});
