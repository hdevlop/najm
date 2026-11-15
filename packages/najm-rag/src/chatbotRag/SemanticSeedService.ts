import { Service, Inject, Meta, LoggerService } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { SemanticPhraseService } from './SemanticPhraseService';
import type { SemanticSeedStatus } from './ChatbotRagDto';

/**
 * Adds the app's `seedSemantics` phrases that are not stored yet, in the
 * background after boot, when boot tool indexing is on. Runs after
 * ToolIndexerService (order 55) and, like it, skips when the embedding
 * provider is unreachable: the next boot retries.
 *
 * Hosts often log at ERROR only, which hid why a seed did nothing, so every
 * outcome (progress, unknown tools, an unreachable provider, failed batches)
 * is also kept in `status()`, which /status and the studio dashboard show.
 */
@Service()
@Meta({ layer: 'plugin', order: 56 })
export class SemanticSeedService {
  /** The background run started by onReady, for tests and diagnostics. */
  running: Promise<void> | null = null;
  private state: SemanticSeedStatus | null = null;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private embedding: EmbeddingService,
    @Inject() private semantics: SemanticPhraseService,
    @Inject(LoggerService) private log: LoggerService,
  ) {}

  /** The seed's state, or null when the app configures no seed. */
  status(): SemanticSeedStatus | null {
    if (!this.config.seedSemantics) return null;
    if (!this.state) return this.initial(this.bootSeedEnabled() ? 'waiting' : 'disabled');
    return { ...this.state, unknownTools: [...this.state.unknownTools] };
  }

  private bootSeedEnabled(): boolean {
    const indexOnBoot = this.config.rag?.indexOnBoot ?? (this.config.toolRouting as any)?.indexOnBoot;
    return this.config.toolRouting?.enabled === true && indexOnBoot !== false;
  }

  private initial(state: SemanticSeedStatus['state']): SemanticSeedStatus {
    return { state, total: 0, done: 0, inserted: 0, alreadyStored: 0, failed: 0, unknownTools: [] };
  }

  onReady(): void {
    const seed = this.config.seedSemantics;
    if (!seed) return;
    if (!this.bootSeedEnabled()) { this.state = this.initial('disabled'); return; }

    this.state = { ...this.initial('waiting'), startedAt: new Date().toISOString() };
    this.running = (async () => {
      const health = await this.embedding.health(undefined, { retries: 1 });
      if (!health.ok) {
        const reason = `embedding provider unreachable${health.error ? ` (${health.error})` : ''}; the seed runs on the next boot`;
        this.finish('skipped', reason);
        this.log.warn(`[chatbot-rag] Semantic seed skipped: ${reason}.`);
        return;
      }
      this.state = { ...this.state!, state: 'running' };
      try {
        const result = await this.semantics.seedSemantics(seed, {
          onProgress: (progress) => { this.state = { ...this.state!, ...progress, state: 'running' }; },
        });
        this.state = { ...this.state!, ...result };
        const stopped = this.state.done < this.state.total;
        this.finish(stopped ? 'failed' : 'done', result.lastError);
        if (result.unknownTools.length) {
          this.log.warn(`[chatbot-rag] Semantic seed names tools that are not registered; their phrases were skipped: ${[...new Set(result.unknownTools)].join(', ')}`);
        }
        if (result.failed) this.log.warn(`[chatbot-rag] Semantic seed: ${result.failed} phrases failed. Last error: ${result.lastError}`);
        if (result.inserted || result.failed) this.log.info('[chatbot-rag] Semantic seed applied.', result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.finish('failed', message);
        this.log.error?.('[chatbot-rag] Semantic seed failed:', error);
      }
    })();
    void this.running;
  }

  private finish(state: SemanticSeedStatus['state'], lastError?: string): void {
    this.state = {
      ...this.state!,
      state,
      finishedAt: new Date().toISOString(),
      ...(lastError ? { lastError } : {}),
    };
  }
}
