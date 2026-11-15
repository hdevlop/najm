import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { eq, inArray } from 'drizzle-orm';
import { VECTOR_STRATEGY } from '../tokens';
import type { VectorStrategy } from '../vectorStore';
import type { ChunkWithSource } from './KnowledgeDto';
import { KnowledgeValidator } from './KnowledgeValidator';

/**
 * Source metadata as callers see it: without the pasted-text body that older
 * text documents store under `sourceText`.
 */
export function publicSourceMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return (metadata as any) ?? null;
  if (!('sourceText' in metadata)) return metadata as Record<string, unknown>;
  const { sourceText: _body, ...rest } = metadata as Record<string, unknown>;
  return rest;
}

/** `enabled` is text ('true'/'false') on PostgreSQL and an integer on SQLite. */
function isChunkEnabled(value: unknown): boolean {
  return !(value === false || value === 0 || value === '0' || value === 'false');
}

@Repository()
export class KnowledgeRepository {
  @DB() declare db: any;
  @Inject(VECTOR_STRATEGY) private vectors!: VectorStrategy;
  @Inject() private validator!: KnowledgeValidator;

  async searchChunks(
    embedding: number[],
    limit: number,
    threshold: number,
  ): Promise<Array<{ chunkId: string; similarity: number }>> {
    const table = this.validator.embeddingsTable();
    const matches = await this.vectors.searchBy(this.db, table, 'chunkId', embedding, limit, threshold);
    return matches.map((m) => ({ chunkId: m.key, similarity: m.similarity }));
  }

  /** Whether any chunk has been embedded, so an empty knowledge base costs no embedding call. */
  async hasEmbeddings(): Promise<boolean> {
    const table = this.validator.embeddingsTable();
    const rows = await this.db.select({ chunkId: table.chunkId }).from(table).limit(1);
    return (rows ?? []).length > 0;
  }

  async findChunksWithSource(chunkIds: string[]): Promise<ChunkWithSource[]> {
    if (chunkIds.length === 0) return [];
    const chunks = this.validator.chunksTable();
    const sources = this.validator.sourcesTable();

    // Sources are loaded once each, not once per matching chunk: their
    // metadata can be large (older text documents keep their whole body there).
    const allChunkRows = await this.db
      .select({ chunkId: chunks.id, text: chunks.text, page: chunks.page, ordinal: chunks.ordinal,
        documentId: chunks.documentId, enabled: chunks.enabled })
      .from(chunks)
      .where(inArray(chunks.id, chunkIds));
    const chunkRows = (allChunkRows ?? []).filter((row: any) => isChunkEnabled(row.enabled));
    if (!chunkRows.length) return [];

    const documentIds = [...new Set<string>(chunkRows.map((row: any) => row.documentId))];
    const sourceRows = await this.db
      .select({ id: sources.id, namespace: sources.namespace, sourceType: sources.sourceType,
        originalPath: sources.originalPath, metadata: sources.metadata })
      .from(sources)
      .where(inArray(sources.id, documentIds));
    const sourceById = new Map<string, any>(sourceRows.map((row: any) => [row.id, row]));

    return chunkRows.flatMap((row: any) => {
      const source = sourceById.get(row.documentId);
      if (!source) return [];
      return [{
        chunkId: row.chunkId,
        text: row.text,
        page: row.page,
        ordinal: row.ordinal,
        docId: source.id,
        namespace: source.namespace,
        sourceType: source.sourceType,
        originalPath: source.originalPath,
        metadata: publicSourceMetadata(source.metadata),
      }];
    });
  }
}
