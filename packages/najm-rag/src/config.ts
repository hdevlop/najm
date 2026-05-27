export type RagDialect = 'sqlite' | 'pg' | 'mysql';

export type ToolRoutingFallback = 'all' | 'none';

export interface RagEmbeddingConfig {
  provider?: 'ollama';
  baseUrl?: string;
  model?: string;
  dimensions?: number;
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
  studioApi?: boolean;
  studioUi?: boolean;
  /**
   * BCP-47 language codes the studio is allowed to assign to semantic phrases.
   * If omitted, all known languages are offered. Example: ['en', 'fr', 'ar'].
   */
  allowedLangs?: string[];
}

export interface RagMergedConfig {
  dialect: RagDialect;
  configPath?: string;
  studioApi?: boolean;
  studioUi?: boolean;
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
