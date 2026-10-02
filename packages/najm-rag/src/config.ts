export type RagDialect = 'sqlite' | 'pg' | 'mysql';

export type ToolRoutingFallback = 'all' | 'none';

export interface RagEmbeddingConfig {
  provider?: 'ollama' | 'openai-compatible';
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  /** Optional bearer key. Server configuration only; never exposed by RAG Studio. */
  apiKey?: string;
  /** Maximum inputs per HTTP request; batches are sent sequentially. Default: 16. */
  batchSize?: number;
  /** Opt in to shortening a longer MRL vector and normalizing the result. */
  truncateDimensions?: boolean;
  /** Model-specific retrieval prefixes. Empty by default for compatibility. */
  queryPrefix?: string;
  documentPrefix?: string;
  /**
   * Per-request timeout in milliseconds for embedding calls. Hung or slow
   * upstream models (e.g. Ollama model loading) are aborted after this
   * duration so the rest of the chat pipeline can fall back gracefully.
   * Defaults to 8000ms.
   */
  timeoutMs?: number;
  /**
   * Timeout in milliseconds for lightweight health checks. Health checks still
   * issue a real embedding request, so cold local models often need more than
   * a ping-sized timeout during app boot. Defaults to 15000ms.
   */
  healthTimeoutMs?: number;
}

export interface RagToolRoutingConfig {
  enabled?: boolean;
  maxTools?: number;
  topSemanticHits?: number;
  similarityThreshold?: number;
  fallbackOnRouterError?: ToolRoutingFallback;
  fallbackOnNoMatch?: ToolRoutingFallback;
  dependencies?: Record<string, string[]>;
}

export interface RagKnowledgeConfig {
  enabled?: boolean;
  namespace?: string;
  basePath?: string;
}

export interface RagConfig {
  dialect?: RagDialect;
  configPath?: string;
  embedding?: RagEmbeddingConfig;
  queryEmbeddingCacheSize?: number;
  indexOnBoot?: boolean;
  toolRouting?: RagToolRoutingConfig;
  knowledge?: boolean | RagKnowledgeConfig;
  /**
   * BCP-47 language codes allowed for semantic phrases. If omitted, all known
   * languages are offered. Consumed by routing settings and surfaced to the
   * RAG Studio. Example: ['en', 'fr', 'ar'].
   */
  allowedLangs?: string[];
}

export interface RagMergedConfig {
  dialect: RagDialect;
  configPath?: string;
  allowedLangs?: string[];
  knowledge?: {
    enabled: boolean;
    namespace: string;
    basePath: string;
  };
  rag: {
    enabled: boolean;
    embedding: {
      provider: 'ollama' | 'openai-compatible';
      baseUrl: string;
      model: string;
      /** Unset means 768 for validation, and no `dimensions` field is sent to the provider. */
      dimensions?: number;
      apiKey?: string;
      batchSize?: number;
      truncateDimensions?: boolean;
      queryPrefix?: string;
      documentPrefix?: string;
      timeoutMs: number;
      healthTimeoutMs: number;
    };
    queryEmbeddingCacheSize: number;
    indexOnBoot: boolean;
  };
  toolRouting: {
    enabled: boolean;
    maxTools: number;
    topSemanticHits: number;
    similarityThreshold: number;
    fallbackOnRouterError: ToolRoutingFallback;
    fallbackOnNoMatch: ToolRoutingFallback;
    dependencies: Record<string, string[]>;
  };
}

export interface RagSchema {
  chatbotToolEmbeddings: any;
  chatbotToolSemantics: any;
  chatbotRoutingSettings: any;
  chatbotDocumentSources?: any;
  chatbotDocumentChunks?: any;
  chatbotDocumentEmbeddings?: any;
  chatbotStudioAuditLogs?: any;
  chatbotUnmatchedQueries?: any;
  chatbotRoutingTests?: any;
}
