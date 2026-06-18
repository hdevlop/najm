import { Service, Inject } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import type { EmbeddingConfig, EmbeddingResponse } from './EmbeddingDto';
import { EmbeddingValidator } from './EmbeddingValidator';
import { EmbeddingLru } from './EmbeddingUtils';

@Service()
export class EmbeddingService {
  private queryCache: EmbeddingLru;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private validator: EmbeddingValidator,
  ) {
    const cacheSize =
      this.config.rag?.queryEmbeddingCacheSize ??
      (this.config as any).toolRouting?.queryEmbeddingCacheSize ??
      256;
    this.queryCache = new EmbeddingLru(Math.max(0, cacheSize));
  }

  private get embeddingConfig(): EmbeddingConfig & { timeoutMs: number } {
    const emb = this.config.rag?.embedding ?? (this.config as any).toolRouting?.embedding;
    return {
      provider: emb?.provider ?? 'ollama',
      baseUrl: emb?.baseUrl ?? 'http://localhost:11434',
      model: emb?.model ?? 'embeddinggemma',
      timeoutMs: (emb as any)?.timeoutMs ?? 8000,
    };
  }

  async embed(text: string): Promise<number[]> {
    const cached = this.queryCache.get(text);
    if (cached) return cached;
    const results = await this.embedBatch([text]);
    if (!results[0]) {
      throw new Error('Embedding service returned empty result for single text');
    }
    this.queryCache.set(text, results[0]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { baseUrl, model, timeoutMs } = this.embeddingConfig;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as EmbeddingResponse;
      return this.validator.assertResponse(data, texts.length);
    } catch (err) {
      const aborted = (err as any)?.name === 'AbortError';
      if (aborted) {
        throw new Error(`Embedding request timed out after ${timeoutMs}ms — is the embedding provider reachable?`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  static toVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  async health(timeoutMs = 3000): Promise<EmbeddingHealth> {
    const { provider, baseUrl, model } = this.embeddingConfig;
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: ['ok'] }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          ok: false,
          provider,
          baseUrl,
          model,
          error: `HTTP ${res.status} ${res.statusText}`,
          latencyMs: Date.now() - started,
        };
      }
      return { ok: true, provider, baseUrl, model, latencyMs: Date.now() - started };
    } catch (err) {
      const aborted = (err as any)?.name === 'AbortError';
      const message = aborted
        ? `No response within ${timeoutMs}ms — is ${provider} running at ${baseUrl}?`
        : err instanceof Error ? err.message : String(err);
      return { ok: false, provider, baseUrl, model, error: message, latencyMs: Date.now() - started };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface EmbeddingHealth {
  ok: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  error?: string;
  latencyMs: number;
}
