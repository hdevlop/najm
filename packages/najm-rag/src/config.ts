export type RagDialect = 'sqlite' | 'pg' | 'mysql';

export type ToolRoutingFallback = 'all' | 'none';

export interface RagEmbeddingConfig {
  provider?: 'ollama';
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  /**
   * Per-request timeout in milliseconds for embedding calls. Hung or slow
   * upstream models (e.g. Ollama model loading) are aborted after this
   * duration so the rest of the chat pipeline can fall back gracefully.
   * Defaults to 8000ms.
   */
  timeoutMs?: number;
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
      provider: 'ollama';
      baseUrl: string;
      model: string;
      dimensions: number;
      timeoutMs: number;
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
