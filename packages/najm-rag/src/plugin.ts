import { plugin } from 'najm-core';
import { TOOL_PROVIDER } from 'najm-mcp';
import { RAG_CONFIG, RAG_SCHEMA, VECTOR_STRATEGY, RAG_OCR_PROVIDER } from './tokens';
import {
  EmbeddingService,
  EmbeddingValidator,
  ToolIndexRepository,
  ToolIndexValidator,
  SqliteVecBootService,
  ToolRouterValidator,
  ToolRoutingLoader,
  ToolIndexerService,
  ToolRouterService,
  RoutingPreviewService,
  ChatbotRagValidator,
  ChatbotRagController,
  SemanticPhraseService,
  SemanticImportJobService,
  ToolMetadataService,
  RoutingSettingsService,
  RoutingSettingsRepository,
  UnmatchedQueryRepository,
  UnmatchedQueryService,
  RoutingTestsRepository,
  RoutingTestsService,
  KnowledgeService,
  KnowledgeContextProvider,
  KnowledgeRepository,
  KnowledgeValidator,
  DocumentSourceRepository,
  DocumentIngestionService,
  FileExtractor,
  PdfExtractor,
  NoopOcrProvider,
  KnowledgeDocumentService,
} from './rag-index';
import { PgVectorStrategy, SqliteVecStrategy } from './vectorStore';
import { ragSchema as sqliteSchema } from './schema/sqlite';
import { ragSchema as pgSchema } from './schema/pg';
import { ragSchema as mysqlSchema } from './schema/mysql';
import { loadRagRoutingConfig } from './config/loadRoutingConfig';
import type { RagConfig, RagMergedConfig, RagDialect } from './config';

const defaultRag = {
  enabled: false,
  embedding: {
    provider: 'ollama' as const,
    baseUrl: 'http://localhost:11434',
    model: 'embeddinggemma',
    dimensions: 768,
    timeoutMs: 8000,
  },
  queryEmbeddingCacheSize: 256,
  indexOnBoot: true,
};

const defaultToolRouting = {
  enabled: false,
  maxTools: 12,
  topSemanticHits: 8,
  similarityThreshold: 0.45,
  fallbackOnRouterError: 'all' as const,
  fallbackOnNoMatch: 'none' as const,
  dependencies: {},
};

const CHATBOT_CONTEXT_PROVIDER = Symbol.for('najm:chatbot:context-provider');

const resolveSchema = (config?: RagConfig) => {
  if (config?.dialect === 'sqlite') return sqliteSchema;
  if (config?.dialect === 'mysql') return mysqlSchema;
  return pgSchema;
};

const resolveKnowledge = (config?: RagConfig): { enabled: boolean; namespace: string; basePath: string } => {
  if (!config?.knowledge) return { enabled: false, namespace: 'rag', basePath: 'storage' };
  if (config.knowledge === true) return { enabled: true, namespace: 'rag', basePath: 'storage' };
  return {
    enabled: config.knowledge.enabled ?? true,
    namespace: config.knowledge.namespace ?? 'rag',
    basePath: config.knowledge.basePath ?? 'storage',
  };
};



const mergeConfig = (config?: RagConfig): RagMergedConfig => {
  const jsonConfig = config?.configPath ? loadRagRoutingConfig(config.configPath) : {};

  const effective: RagConfig = {
    ...jsonConfig,
    ...config,
    embedding: {
      ...(jsonConfig as any).embedding,
      ...(config?.embedding ?? {}),
    },
    toolRouting: {
      ...(jsonConfig as any).toolRouting,
      ...(config?.toolRouting ?? {}),
    },
  };

  const dialect = effective.dialect ?? 'pg';
  const jsonMode = (jsonConfig as any).mode;
  const ragEnabled =
    effective.embedding !== undefined ||
    effective.toolRouting?.enabled === true ||
    effective.indexOnBoot !== undefined ||
    jsonMode === 'rag' ||
    jsonMode === 'routing';
  const routingEnabled = effective.toolRouting?.enabled === true || jsonMode === 'routing';

  if (routingEnabled) {
    if (dialect !== 'pg' && dialect !== 'sqlite') {
      throw new Error(`najm-rag tool routing requires dialect "pg" or "sqlite". Received: "${dialect}"`);
    }
  }

  return {
    dialect: dialect as RagDialect,
    configPath: effective.configPath,
    allowedLangs: Array.isArray(effective.allowedLangs) && effective.allowedLangs.length > 0
      ? effective.allowedLangs
      : undefined,
    knowledge: resolveKnowledge(effective),
    rag: {
      enabled: ragEnabled,
      embedding: {
        ...defaultRag.embedding,
        ...effective.embedding,
      },
      queryEmbeddingCacheSize: effective.queryEmbeddingCacheSize ?? defaultRag.queryEmbeddingCacheSize,
      indexOnBoot: effective.indexOnBoot ?? defaultRag.indexOnBoot,
    },
    toolRouting: {
      ...defaultToolRouting,
      ...effective.toolRouting,
      enabled: routingEnabled,
    },
  };
};

export const rag = (config?: RagConfig) => {
  const merged = mergeConfig(config);
  const ragEnabled = merged.rag.enabled;
  const routingEnabled = merged.toolRouting.enabled;
  const knowledgeEnabled = (merged as any).knowledge?.enabled === true;
  const vectorStrategy = merged.dialect === 'sqlite' ? new SqliteVecStrategy() : new PgVectorStrategy();

  const services: any[] = [];

  if (ragEnabled) {
    services.push(
      EmbeddingService,
      EmbeddingValidator,
      ToolIndexRepository,
      ToolIndexValidator,
      SqliteVecBootService,
    );
  }

  if (routingEnabled) {
    services.push(
      ToolRouterValidator,
      ToolRoutingLoader,
      ToolIndexerService,
      ToolRouterService,
      RoutingPreviewService,
      ChatbotRagValidator,
      ChatbotRagController,
      SemanticPhraseService,
      SemanticImportJobService,
      ToolMetadataService,
      RoutingSettingsService,
      RoutingSettingsRepository,
      UnmatchedQueryRepository,
      UnmatchedQueryService,
      RoutingTestsRepository,
      RoutingTestsService,
    );
  }

  // ChatbotRagController (registered when routingEnabled) eagerly injects
  // KnowledgeDocumentService, so the service must be registered whenever
  // routing is on even if knowledge is disabled. Its constructor dependencies
  // are optional and gracefully degrade when knowledge-only repos are absent.
  if (routingEnabled && !knowledgeEnabled) {
    services.push(KnowledgeDocumentService);
  }

  if (knowledgeEnabled) {
    services.push(
      KnowledgeValidator,
      KnowledgeRepository,
      KnowledgeService,
      KnowledgeDocumentService,
      DocumentSourceRepository,
      DocumentIngestionService,
      FileExtractor,
      PdfExtractor,
    );
  }

  if (knowledgeEnabled && routingEnabled) {
    services.push(KnowledgeContextProvider);
  }

  const requiredPlugins: string[] = ['auth', 'database'];
  if (routingEnabled) requiredPlugins.push('mcp');
  if (knowledgeEnabled) requiredPlugins.push('storage');

  const builder = plugin('rag')
    .version('1.0.0')
    .requires(...requiredPlugins)
    .services(...services)
    .config(RAG_CONFIG, merged)
    .set(RAG_SCHEMA, resolveSchema(config))
    .set(VECTOR_STRATEGY, vectorStrategy)
    .set(RAG_OCR_PROVIDER, new NoopOcrProvider());

  if (routingEnabled) {
    builder.alias(TOOL_PROVIDER, ToolRouterService);
    const CHATBOT_ROUTING_PREVIEW_PROVIDER = Symbol.for('najm:chatbot:routing-preview-provider');
    builder.alias(CHATBOT_ROUTING_PREVIEW_PROVIDER, RoutingPreviewService);
  }

  if (knowledgeEnabled && routingEnabled) {
    builder.alias(CHATBOT_CONTEXT_PROVIDER, KnowledgeContextProvider);
  }

  return builder.build();
};
