import { Service, Inject, Meta, LoggerService } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { SemanticPhraseService } from './SemanticPhraseService';

/**
 * Adds the app's `seedSemantics` phrases that are not stored yet, in the
 * background after boot, when boot tool indexing is on. Runs after
 * ToolIndexerService (order 55) and, like it, skips quietly when the embedding
 * provider is unreachable: the next boot retries.
 */
@Service()
@Meta({ layer: 'plugin', order: 56 })
export class SemanticSeedService {
  /** The background run started by onReady, for tests and diagnostics. */
  running: Promise<void> | null = null;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private embedding: EmbeddingService,
    @Inject() private semantics: SemanticPhraseService,
    @Inject(LoggerService) private log: LoggerService,
  ) {}

  onReady(): void {
    const seed = this.config.seedSemantics;
    const indexOnBoot = this.config.rag?.indexOnBoot ?? (this.config.toolRouting as any)?.indexOnBoot;
    if (!seed || this.config.toolRouting?.enabled !== true || indexOnBoot === false) return;

    this.running = (async () => {
      const health = await this.embedding.health(undefined, { retries: 1 });
      if (!health.ok) {
        this.log.warn(`[chatbot-rag] Embedding provider unreachable; semantic seed skipped until the next boot.`);
        return;
      }
      try {
        const result = await this.semantics.seedSemantics(seed);
        if (result.unknownTools.length) {
          this.log.warn(`[chatbot-rag] Semantic seed names tools that are not registered; their phrases were skipped: ${[...new Set(result.unknownTools)].join(', ')}`);
        }
        if (result.inserted || result.failed) this.log.info('[chatbot-rag] Semantic seed applied.', result);
      } catch (error) {
        this.log.error?.('[chatbot-rag] Semantic seed failed:', error);
      }
    })();
    void this.running;
  }
}
