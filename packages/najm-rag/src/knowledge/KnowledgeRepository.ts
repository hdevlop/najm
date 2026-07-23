import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { eq, inArray } from 'drizzle-orm';
import { VECTOR_STRATEGY } from '../tokens';
import type { VectorStrategy } from '../vectorStore';
import type { ChunkWithSource } from './KnowledgeDto';
import { KnowledgeValidator } from './KnowledgeValidator';

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

  async findChunksWithSource(chunkIds: string[]): Promise<ChunkWithSource[]> {
    if (chunkIds.length === 0) return [];
    const chunks = this.validator.chunksTable();
    const sources = this.validator.sourcesTable();

    const rows = await this.db
      .select({
        chunkId: chunks.id,
        text: chunks.text,
        page: chunks.page,
        ordinal: chunks.ordinal,
        docId: sources.id,
        namespace: sources.namespace,
        sourceType: sources.sourceType,
        originalPath: sources.originalPath,
        metadata: sources.metadata,
      })
      .from(chunks)
      .innerJoin(sources, eq(chunks.documentId, sources.id))
      .where(inArray(chunks.id, chunkIds));

    return rows ?? [];
  }
}
