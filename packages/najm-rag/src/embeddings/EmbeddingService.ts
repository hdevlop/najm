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

  private get embeddingConfig(): EmbeddingConfig & { timeoutMs: number; healthTimeoutMs: number } {
    const emb = this.config.rag?.embedding ?? (this.config as any).toolRouting?.embedding;
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
    const dimensions = emb?.dimensions ?? 768;
    if (!Number.isInteger(batchSize) || batchSize < 1 || !Number.isInteger(dimensions) || dimensions < 1) {
      throw new Error('Embedding batch size and dimensions must be positive integers');
    }
    return {
      provider,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      model: emb?.model ?? 'embeddinggemma',
      dimensions,
      batchSize,
      truncateDimensions: emb?.truncateDimensions ?? false,
      apiKey: emb?.apiKey,
      queryPrefix: emb?.queryPrefix ?? '',
      documentPrefix: emb?.documentPrefix ?? '',
      timeoutMs: (emb as any)?.timeoutMs ?? 8000,
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
    const { batchSize, timeoutMs } = this.embeddingConfig;
    const results: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += batchSize!) {
      results.push(...await this.requestEmbeddings(texts.slice(offset, offset + batchSize!), purpose, timeoutMs));
    }
    return results;
  }

  private async requestEmbeddings(texts: string[], purpose: 'query' | 'document', timeoutMs: number): Promise<number[][]> {
    const { provider, baseUrl, model, apiKey, dimensions, truncateDimensions, queryPrefix, documentPrefix } = this.embeddingConfig;
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
        body: JSON.stringify({ model, input, ...(openAi ? { encoding_format: 'float', dimensions } : {}) }),
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.status}`);
      }

      const data = await response.json();
      return openAi
        ? this.validator.assertOpenAiResponse(data, texts.length, dimensions, truncateDimensions)
        : this.validator.assertResponse(data, texts.length, dimensions);
    } catch (err) {
      const aborted = (err as any)?.name === 'AbortError';
      if (aborted) {
        throw new Error(`Embedding request timed out after ${timeoutMs}ms — is ${provider} running at ${baseUrl}?`);
      }
      if (err instanceof TypeError) {
        throw new Error(`Embedding request could not reach ${provider} at ${baseUrl} — check the endpoint and authentication`);
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
    try {
      // Validate the same authenticated request and vector contract used by reads/indexing.
      await this.requestEmbeddings(['ok'], 'query', timeoutMs);
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
