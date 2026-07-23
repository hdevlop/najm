import { describe, test, expect, mock } from 'bun:test';
import { KnowledgeService } from '../src/knowledge/KnowledgeService';
import { KnowledgeContextProvider } from '../src/knowledge/KnowledgeContextProvider';
import { ChatbotRagController } from '../src/chatbotRag/ChatbotRagController';
import { ChatbotRagValidator } from '../src/chatbotRag/ChatbotRagValidator';
import { NoopOcrProvider, NoopCaptionProvider } from '../src/knowledge/OcrProvider';
import { normalizeVectorRows } from '../src/vectorStore';

// ---------------------------------------------------------------------------
// NoopOcrProvider / NoopCaptionProvider
// ---------------------------------------------------------------------------

describe('NoopOcrProvider', () => {
  test('returns empty string for any path', async () => {
    const provider = new NoopOcrProvider();
    expect(provider.name).toBe('noop');
    const result = await provider.extract('/any/path.pdf');
    expect(result).toBe('');
  });
});

describe('NoopCaptionProvider', () => {
  test('returns empty string for any path', async () => {
    const provider = new NoopCaptionProvider();
    expect(provider.name).toBe('noop');
    const result = await provider.caption('/any/image.png');
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// normalizeVectorRows
// ---------------------------------------------------------------------------

describe('normalizeVectorRows', () => {
  test('converts camelCase key to snake_case for lookup', () => {
    const rows = [{ chunk_id: 'abc', similarity: 0.9 }];
    const result = normalizeVectorRows(rows, 'chunkId');
    expect(result).toEqual([{ key: 'abc', similarity: 0.9 }]);
  });

  test('falls back to direct key name when snake_case not found', () => {
    const rows = [{ chunkId: 'xyz', similarity: 0.7 }];
    const result = normalizeVectorRows(rows, 'chunkId');
    expect(result).toEqual([{ key: 'xyz', similarity: 0.7 }]);
  });

  test('handles pg-style rows wrapper', () => {
    const rows = { rows: [{ chunk_id: 'p1', similarity: 0.85 }] };
    const result = normalizeVectorRows(rows, 'chunkId');
    expect(result).toEqual([{ key: 'p1', similarity: 0.85 }]);
  });

  test('returns empty array for empty input', () => {
    expect(normalizeVectorRows([], 'chunkId')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// KnowledgeService
// ---------------------------------------------------------------------------

function makeChunk(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    chunkId: 'chunk-1',
    text: 'The quick brown fox',
    page: 1,
    ordinal: 0,
    docId: 'doc-1',
    namespace: 'rag',
    sourceType: 'pdf',
    originalPath: 'storage/rag/sources/doc-1/original.pdf',
    metadata: null,
    ...overrides,
  };
}

function makeKnowledgeService(overrides: Partial<Record<string, unknown>> = {}) {
  const repository = {
    searchChunks: mock(() => Promise.resolve([{ chunkId: 'chunk-1', similarity: 0.91 }])),
    findChunksWithSource: mock(() => Promise.resolve([makeChunk()])),
    ...(overrides.repository as any),
  };
  const embedding = {
    embed: mock(() => Promise.resolve(new Array(768).fill(0.1))),
    ...(overrides.embedding as any),
  };
  const config = { toolRouting: { similarityThreshold: 0.45 } };

  const service = new KnowledgeService(
    repository as any,
    embedding as any,
    config as any,
  );

  return { service, repository, embedding };
}

describe('KnowledgeService.search', () => {
  test('returns citations with chunk text and document metadata', async () => {
    const { service } = makeKnowledgeService();
    const result = await service.search('fox story');

    expect(result.query).toBe('fox story');
    expect(result.citations).toHaveLength(1);

    const citation = result.citations[0];
    expect(citation.chunkId).toBe('chunk-1');
    expect(citation.similarity).toBe(0.91);
    expect(citation.text).toBe('The quick brown fox');
    expect(citation.page).toBe(1);
    expect(citation.ordinal).toBe(0);
    expect(citation.document.id).toBe('doc-1');
    expect(citation.document.sourceType).toBe('pdf');
    expect(citation.document.namespace).toBe('rag');
  });

  test('embeds the query before searching', async () => {
    const { service, embedding } = makeKnowledgeService();
    await service.search('my query');
    expect(embedding.embed).toHaveBeenCalledWith('my query');
  });

  test('forwards limit to repository', async () => {
    const searchChunks = mock(() => Promise.resolve([]));
    const { service } = makeKnowledgeService({ repository: { searchChunks, findChunksWithSource: mock(() => Promise.resolve([])) } });
    await service.search('q', 10);
    expect(searchChunks.mock.calls[0][1]).toBe(10);
  });

  test('uses config threshold when not specified', async () => {
    const searchChunks = mock(() => Promise.resolve([]));
    const { service } = makeKnowledgeService({ repository: { searchChunks, findChunksWithSource: mock(() => Promise.resolve([])) } });
    await service.search('q');
    expect(searchChunks.mock.calls[0][2]).toBe(0.45);
  });

  test('uses explicit threshold when provided', async () => {
    const searchChunks = mock(() => Promise.resolve([]));
    const { service } = makeKnowledgeService({ repository: { searchChunks, findChunksWithSource: mock(() => Promise.resolve([])) } });
    await service.search('q', 5, 0.75);
    expect(searchChunks.mock.calls[0][2]).toBe(0.75);
  });

  test('returns empty citations when no chunks match', async () => {
    const { service } = makeKnowledgeService({
      repository: {
        searchChunks: mock(() => Promise.resolve([])),
        findChunksWithSource: mock(() => Promise.resolve([])),
      },
    });
    const result = await service.search('unknown');
    expect(result.citations).toHaveLength(0);
  });

  test('skips citation if chunk row not found in join', async () => {
    const { service } = makeKnowledgeService({
      repository: {
        searchChunks: mock(() => Promise.resolve([{ chunkId: 'ghost', similarity: 0.8 }])),
        findChunksWithSource: mock(() => Promise.resolve([])),
      },
    });
    const result = await service.search('something');
    expect(result.citations).toHaveLength(0);
  });

  test('preserves match order from vector search', async () => {
    const chunks = [
      makeChunk({ chunkId: 'c1', text: 'first' }),
      makeChunk({ chunkId: 'c2', text: 'second' }),
    ];
    const { service } = makeKnowledgeService({
      repository: {
        searchChunks: mock(() =>
          Promise.resolve([
            { chunkId: 'c1', similarity: 0.95 },
            { chunkId: 'c2', similarity: 0.80 },
          ]),
        ),
        findChunksWithSource: mock(() => Promise.resolve(chunks)),
      },
    });
    const result = await service.search('test');
    expect(result.citations[0].chunkId).toBe('c1');
    expect(result.citations[1].chunkId).toBe('c2');
  });
});

// ---------------------------------------------------------------------------
// KnowledgeDocumentService.searchKnowledge
// ---------------------------------------------------------------------------

function makeKnowledgeDocumentService(overrides: Partial<Record<string, unknown>> = {}) {
  const docRepo = {
    countEmbeddings: mock(() => Promise.resolve(0)),
    countSemantics: mock(() => Promise.resolve(0)),
  } as any;
  const ingestion = {} as any;
  const knowledge = {
    search: mock(() => Promise.resolve({ query: '', citations: [] })),
  } as any;
  const service = new (require('../src/knowledge/KnowledgeDocumentService').KnowledgeDocumentService)(
    { ...docRepo, ...(overrides.docRepo as any) },
    { ...ingestion, ...(overrides.ingestion as any) },
    { ...knowledge, ...(overrides.knowledge as any) },
  );
  return { service, docRepo, ingestion, knowledge };
}

describe('KnowledgeDocumentService.searchKnowledge', () => {
  test('delegates to KnowledgeService when available', async () => {
    const { service, knowledge } = makeKnowledgeDocumentService();
    const mockResult = { query: 'test', citations: [{ chunkId: 'c1' }] };
    (service as any).knowledge = {
      search: mock(() => Promise.resolve(mockResult)),
    };
    const result = await service.searchKnowledge('test', 5, 0.5);
    expect((service as any).knowledge.search).toHaveBeenCalledWith('test', 5, 0.5);
    expect(result).toEqual(mockResult);
  });

  test('returns empty citations when KnowledgeService not registered', async () => {
    const { service } = makeKnowledgeDocumentService();
    (service as any).knowledge = undefined;
    const result = await service.searchKnowledge('test');
    expect(result).toEqual({ query: 'test', citations: [] });
  });
});

describe('ChatbotRagValidator semantic import formats', () => {
  test('normalizes grouped semantics format', () => {
    const validator = new ChatbotRagValidator();
    const state = validator.normalizeSemanticImport({
      auth_login: {
        en: ['sign in', 'log in'],
        fr: ['se connecter'],
      },
    });

    expect(state.entries).toEqual([
      { toolName: 'auth_login', phrase: 'sign in', lang: 'en', index: 0 },
      { toolName: 'auth_login', phrase: 'log in', lang: 'en', index: 1 },
      { toolName: 'auth_login', phrase: 'se connecter', lang: 'fr', index: 2 },
    ]);
  });

  test('skips duplicate grouped phrases in same import', () => {
    const validator = new ChatbotRagValidator();
    const state = validator.normalizeSemanticImport({
      auth_login: {
        en: ['sign in', 'sign in'],
      },
    });

    expect(state.entries).toHaveLength(1);
    expect(state.results[1]).toMatchObject({
      toolName: 'auth_login',
      phrase: 'sign in',
      lang: 'en',
      status: 'skipped',
    });
  });
});

describe('KnowledgeContextProvider', () => {
  test('returns null without searching when enableKnowledge is false', async () => {
    const knowledge = { search: mock(() => Promise.resolve({ query: 'q', citations: [] })) };
    const settings = { getEffectiveSettings: mock(() => Promise.resolve({ enableKnowledge: false })) };
    const provider = new KnowledgeContextProvider(knowledge as any, settings as any);

    const result = await provider.getContext('q');

    expect(result).toBeNull();
    expect(knowledge.search).not.toHaveBeenCalled();
  });

  test('formats citations when enableKnowledge is true', async () => {
    const knowledge = {
      search: mock(() => Promise.resolve({
        query: 'q',
        citations: [{
          text: 'Policy text',
          document: { id: 'doc-1', originalPath: 'policy.pdf' },
        }],
      })),
    };
    const settings = { getEffectiveSettings: mock(() => Promise.resolve({ enableKnowledge: true })) };
    const provider = new KnowledgeContextProvider(knowledge as any, settings as any);

    const result = await provider.getContext('q');

    expect(result).toContain('knowledge base excerpts');
    expect(result).toContain('policy.pdf');
    expect(result).toContain('Policy text');
  });
});

// ---------------------------------------------------------------------------
// ChatbotRagController — knowledge search
// ---------------------------------------------------------------------------

describe('ChatbotRagController.searchKnowledge', () => {
  test('delegates to service with query, limit, threshold', async () => {
    const mockResult = { query: 'search', citations: [] };
    const docs = {
      searchKnowledge: mock(() => Promise.resolve(mockResult)),
    } as any;
    const controller = new ChatbotRagController() as any;
    controller.docs = docs;

    const result = await controller.searchKnowledge({ query: 'search', limit: 8, threshold: 0.6 });

    expect(docs.searchKnowledge).toHaveBeenCalledWith('search', 8, 0.6);
    expect(result).toEqual(mockResult);
  });
});
