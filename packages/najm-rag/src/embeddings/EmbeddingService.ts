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

  private get embeddingConfig(): EmbeddingConfig & { timeoutMs: number; healthTimeoutMs: number } {
    const emb = this.config.rag?.embedding ?? (this.config as any).toolRouting?.embedding;
    return {
      provider: emb?.provider ?? 'ollama',
      baseUrl: emb?.baseUrl ?? 'http://localhost:11434',
      model: emb?.model ?? 'embeddinggemma',
      timeoutMs: (emb as any)?.timeoutMs ?? 8000,
      healthTimeoutMs: (emb as any)?.healthTimeoutMs ?? 15000,
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
    const { provider, baseUrl, model, timeoutMs } = this.embeddingConfig;
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
        throw new Error(`Embedding request timed out after ${timeoutMs}ms — is ${provider} running at ${baseUrl}?`);
      }
      // undici surfaces connection failures (ECONNREFUSED, DNS, …) as a bare
      // "TypeError: fetch failed" — rethrow with the provider/baseUrl hint.
      if (err instanceof TypeError) {
        const cause = (err as any)?.cause?.code ?? (err as any)?.cause?.message ?? err.message;
        throw new Error(`Embedding request could not reach ${provider} at ${baseUrl} (${cause}) — is it running?`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  static toVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  async health(timeoutMs?: number, options: EmbeddingHealthOptions = {}): Promise<EmbeddingHealth> {
    const { healthTimeoutMs } = this.embeddingConfig;
    const effectiveTimeoutMs = timeoutMs ?? healthTimeoutMs;
    const retries = Math.max(0, options.retries ?? 0);
    let last: EmbeddingHealth | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.probeHealth(effectiveTimeoutMs);
      last = result;
      if (result.ok || !result.timedOut) {
        return this.toPublicHealth(result);
      }
    }

    return this.toPublicHealth(last!);
  }

  private async probeHealth(timeoutMs: number): Promise<EmbeddingHealthProbe> {
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
      return { ok: false, provider, baseUrl, model, error: message, latencyMs: Date.now() - started, timedOut: aborted };
    } finally {
      clearTimeout(timeout);
    }
  }

  private toPublicHealth(health: EmbeddingHealthProbe): EmbeddingHealth {
    const { timedOut: _timedOut, ...publicHealth } = health;
    return publicHealth;
  }
}

export interface EmbeddingHealthOptions {
  retries?: number;
}

export interface EmbeddingHealth {
  ok: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  error?: string;
  latencyMs: number;
}

interface EmbeddingHealthProbe extends EmbeddingHealth {
  timedOut?: boolean;
}
