import { Service, Inject } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import type { EmbeddingConfig } from './EmbeddingDto';
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

  private resolved?: ResolvedEmbeddingConfig | Error;
  /** End of the `queryFailureCooldownMs` window, and the failure that opened it. */
  private queryUnavailableUntil = 0;
  private queryFailure = '';

  /** Resolved and validated once; an invalid config is remembered and rethrown on use. */
  private get embeddingConfig(): ResolvedEmbeddingConfig {
    if (!this.resolved) {
      try {
        this.resolved = this.resolveConfig();
      } catch (err) {
        this.resolved = err instanceof Error ? err : new Error(String(err));
      }
    }
    if (this.resolved instanceof Error) throw this.resolved;
    return this.resolved;
  }

  private get rawEmbedding() {
    return this.config.rag?.embedding ?? (this.config as any).toolRouting?.embedding;
  }

  private resolveConfig(): ResolvedEmbeddingConfig {
    const emb = this.rawEmbedding;
    const provider = emb?.provider ?? 'ollama';
    if (provider !== 'ollama' && provider !== 'openai-compatible') {
      throw new Error('Unsupported embedding provider');
    }
    const baseUrl = emb?.baseUrl ?? (provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8080/v1');
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new Error('Invalid embedding base URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Embedding base URL must be HTTP(S) without credentials, query or fragment');
    }
    const batchSize = emb?.batchSize ?? 16;
    const requestDimensions = emb?.dimensions;
    const dimensions = requestDimensions ?? 768;
    if (!Number.isInteger(batchSize) || batchSize < 1 || !Number.isInteger(dimensions) || dimensions < 1) {
      throw new Error('Embedding batch size and dimensions must be positive integers');
    }
    const timeoutMs = (emb as any)?.timeoutMs ?? 8000;
    const queryTimeoutMs = (emb as any)?.queryTimeoutMs ?? timeoutMs;
    const queryFailureCooldownMs = (emb as any)?.queryFailureCooldownMs ?? 0;
    if (!(queryTimeoutMs > 0) || !Number.isFinite(queryTimeoutMs)
      || !(queryFailureCooldownMs >= 0) || !Number.isFinite(queryFailureCooldownMs)) {
      throw new Error('Embedding query timeout must be positive and the failure cooldown zero or more');
    }
    return {
      provider,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      model: emb?.model ?? 'embeddinggemma',
      dimensions,
      requestDimensions,
      batchSize,
      truncateDimensions: emb?.truncateDimensions ?? false,
      apiKey: emb?.apiKey,
      queryPrefix: emb?.queryPrefix ?? '',
      documentPrefix: emb?.documentPrefix ?? '',
      timeoutMs,
      queryTimeoutMs,
      queryFailureCooldownMs,
      healthTimeoutMs: (emb as any)?.healthTimeoutMs ?? 15000,
    };
  }

  async embed(text: string, purpose: 'query' | 'document' = 'query'): Promise<number[]> {
    const cacheKey = `${purpose}\0${text}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached) return cached;
    const results = await this.embedBatch([text], purpose);
    if (!results[0]) {
      throw new Error('Embedding service returned empty result for single text');
    }
    this.queryCache.set(cacheKey, results[0]);
    return results[0];
  }

  async embedBatch(texts: string[], purpose: 'query' | 'document' = 'document'): Promise<number[][]> {
    const config = this.embeddingConfig;
    const query = purpose === 'query';
    if (query && Date.now() < this.queryUnavailableUntil) {
      throw new EmbeddingUnavailableError(`Embedding provider skipped after a recent failure: ${this.queryFailure}`);
    }
    const timeoutMs = query ? config.queryTimeoutMs : config.timeoutMs;
    const results: number[][] = [];
    try {
      for (let offset = 0; offset < texts.length; offset += config.batchSize) {
        results.push(...await this.requestEmbeddings(config, texts.slice(offset, offset + config.batchSize), purpose, timeoutMs));
      }
    } catch (err) {
      if (query && err instanceof EmbeddingUnavailableError && config.queryFailureCooldownMs > 0) {
        this.queryUnavailableUntil = Date.now() + config.queryFailureCooldownMs;
        this.queryFailure = err.message;
      }
      throw err;
    }
    if (query) this.queryUnavailableUntil = 0;
    return results;
  }

  private async requestEmbeddings(
    config: ResolvedEmbeddingConfig,
    texts: string[],
    purpose: 'query' | 'document',
    timeoutMs: number,
  ): Promise<number[][]> {
    const { provider, baseUrl, model, apiKey, dimensions, requestDimensions, truncateDimensions, queryPrefix, documentPrefix } = config;
    const prefix = purpose === 'query' ? queryPrefix : documentPrefix;
    const input = texts.map((text) => `${prefix}${text}`);
    const openAi = provider === 'openai-compatible';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${openAi ? '/embeddings' : '/api/embed'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          input,
          // Only forward `dimensions` when configured: many servers and models reject the field.
          ...(openAi ? { encoding_format: 'float', ...(requestDimensions !== undefined ? { dimensions: requestDimensions } : {}) } : {}),
        }),
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.status}`);
      }

      const data = await response.json();
      return openAi
        ? this.validator.assertOpenAiResponse(data, texts.length, dimensions, truncateDimensions)
        : this.validator.assertResponse(data, texts.length, dimensions, truncateDimensions);
    } catch (err) {
      const aborted = (err as any)?.name === 'AbortError';
      if (aborted) {
        throw new EmbeddingUnavailableError(`Embedding request timed out after ${timeoutMs}ms — is ${provider} running at ${baseUrl}?`);
      }
      // Node reports transport failures as TypeError with a `cause.code`; Bun throws an Error with `code`.
      const code = [(err as any)?.cause?.code, (err as any)?.code].find((c) => typeof c === 'string' && /^\w+$/.test(c));
      if (err instanceof TypeError || code) {
        throw new EmbeddingUnavailableError(
          `Embedding request could not reach ${provider} at ${baseUrl}${code ? ` (${code})` : ''} — check the endpoint, redirects and authentication`,
        );
      }
      if (err instanceof SyntaxError) {
        throw new Error('Embedding response is not valid JSON');
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
    let config: ResolvedEmbeddingConfig;
    try {
      config = this.embeddingConfig;
    } catch (err) {
      // The raw base URL may be the invalid (possibly credential-bearing) value, so it is not echoed.
      const emb = this.rawEmbedding;
      return {
        ok: false,
        provider: String(emb?.provider ?? 'ollama'),
        baseUrl: '',
        model: emb?.model ?? 'embeddinggemma',
        error: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
      };
    }
    const effectiveTimeoutMs = timeoutMs ?? config.healthTimeoutMs;
    const retries = Math.max(0, options.retries ?? 0);
    let last: EmbeddingHealth | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.probeHealth(config, effectiveTimeoutMs);
      last = result;
      if (result.ok || !result.timedOut) {
        return this.toPublicHealth(result);
      }
    }

    return this.toPublicHealth(last!);
  }

  private async probeHealth(config: ResolvedEmbeddingConfig, timeoutMs: number): Promise<EmbeddingHealthProbe> {
    const { provider, baseUrl, model } = config;
    const started = Date.now();
    try {
      // Validate the same authenticated request and vector contract used by reads/indexing.
      await this.requestEmbeddings(config, ['ok'], 'query', timeoutMs);
      this.queryUnavailableUntil = 0;
      return { ok: true, provider, baseUrl, model, latencyMs: Date.now() - started };
    } catch (err) {
      const aborted = err instanceof Error && err.message.startsWith('Embedding request timed out');
      const message = aborted
        ? `No response within ${timeoutMs}ms — is ${provider} running at ${baseUrl}?`
        : err instanceof Error ? err.message : String(err);
      return { ok: false, provider, baseUrl, model, error: message, latencyMs: Date.now() - started, timedOut: aborted };
    }
  }

  private toPublicHealth(health: EmbeddingHealthProbe): EmbeddingHealth {
    const { timedOut: _timedOut, ...publicHealth } = health;
    return publicHealth;
  }
}

/** The provider timed out or could not be reached, as opposed to answering badly. */
export class EmbeddingUnavailableError extends Error {
  override name = 'EmbeddingUnavailableError';
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

type ResolvedEmbeddingConfig = Required<Omit<EmbeddingConfig, 'apiKey' | 'dimensions'>> & {
  apiKey?: string;
  /** Effective vector size used for validation. */
  dimensions: number;
  /** Explicitly configured size, the only value forwarded to the provider. */
  requestDimensions?: number;
  timeoutMs: number;
  queryTimeoutMs: number;
  queryFailureCooldownMs: number;
  healthTimeoutMs: number;
};

interface EmbeddingHealthProbe extends EmbeddingHealth {
  timedOut?: boolean;
}
