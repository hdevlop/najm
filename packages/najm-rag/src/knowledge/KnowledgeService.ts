import { Service, Inject } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { KnowledgeRepository } from './KnowledgeRepository';
import type { KnowledgeCitation, KnowledgeSearchResult } from './KnowledgeDto';

@Service()
export class KnowledgeService {
  constructor(
    @Inject() private repository: KnowledgeRepository,
    @Inject() private embedding: EmbeddingService,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
  ) {}

  async search(query: string, limit = 5, threshold?: number): Promise<KnowledgeSearchResult> {
    const resolvedThreshold = threshold ?? this.config.toolRouting?.similarityThreshold ?? 0.45;

    const queryEmbedding = await this.embedding.embed(query);
    const matches = await this.repository.searchChunks(queryEmbedding, limit, resolvedThreshold);

    if (matches.length === 0) {
      return { query, citations: [] };
    }

    const chunkIds = matches.map((m) => m.chunkId);
    const rows = await this.repository.findChunksWithSource(chunkIds);

    const rowMap = new Map(rows.map((r) => [r.chunkId, r]));

    const citations: KnowledgeCitation[] = [];
    for (const match of matches) {
      const row = rowMap.get(match.chunkId);
      if (!row) continue;
      citations.push({
        chunkId: match.chunkId,
        similarity: match.similarity,
        text: row.text,
        page: row.page ?? null,
        ordinal: row.ordinal,
        document: {
          id: row.docId,
          namespace: row.namespace,
          sourceType: row.sourceType as any,
          originalPath: row.originalPath,
          metadata: row.metadata ?? null,
        },
      });
    }

    return { query, citations };
  }
}
