import { plugin } from 'najm-core';
import { TOOL_PROVIDER } from 'najm-mcp';
import { RAG_CONFIG, RAG_DIAGNOSTICS, RAG_SCHEMA, VECTOR_STRATEGY, RAG_OCR_PROVIDER } from './tokens';
import { RagDiagnosticsService } from './diagnostics';
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
import { DEFAULT_SIMILARITY_THRESHOLD, embeddingPresetFor } from './toolRouter/RoutingDefaults';

const defaultRag = {
  enabled: false,
  embedding: {
    provider: 'ollama' as const,
    baseUrl: 'http://localhost:11434',
    model: 'embeddinggemma',
    timeoutMs: 8000,
    healthTimeoutMs: 15000,
  },
  queryEmbeddingCacheSize: 256,
  indexOnBoot: true,
};

const defaultToolRouting = {
  enabled: false,
  maxTools: 12,
  topSemanticHits: 8,
  fallbackOnRouterError: 'all' as const,
  fallbackOnNoMatch: 'none' as const,
  dependencies: {},
};

/** Matches `vector('embedding', { dimensions: 768 })` in schema/pg.ts. */
const PG_VECTOR_DIMENSIONS = 768;

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
  const routingEnabled = effective.toolRouting?.enabled === true || jsonMode === 'routing';
  const knowledge = resolveKnowledge(effective);
  // `effective.embedding` is always an object after merging, so test the inputs.
  // Knowledge ingestion and search need the embedder even without routing.
  const ragEnabled =
    config?.embedding !== undefined ||
    (jsonConfig as any).embedding !== undefined ||
    routingEnabled ||
    knowledge.enabled ||
    effective.indexOnBoot !== undefined ||
    jsonMode === 'rag';

  if (routingEnabled) {
    if (dialect !== 'pg' && dialect !== 'sqlite') {
      throw new Error(`najm-rag tool routing requires dialect "pg" or "sqlite". Received: "${dialect}"`);
    }
  }

  const dimensions = effective.embedding?.dimensions;
  if (ragEnabled && dialect === 'pg' && dimensions !== undefined && dimensions !== PG_VECTOR_DIMENSIONS) {
    throw new Error(
      `najm-rag pg storage is fixed at vector(${PG_VECTOR_DIMENSIONS}); embedding.dimensions ${dimensions} is not supported. `
      + 'Use a model or truncateDimensions setting that yields 768 values.',
    );
  }

  const embedding = {
    ...defaultRag.embedding,
    ...(effective.embedding?.provider === 'openai-compatible'
      ? { baseUrl: 'http://localhost:8080/v1' }
      : {}),
    ...effective.embedding,
  };
  // Model prompts (EmbeddingGemma's retrieval prompts) when the app sets no
  // prefix, with the threshold measured for them unless one is set.
  const preset = embeddingPresetFor(embedding);
  if (preset) Object.assign(embedding, { queryPrefix: preset.queryPrefix, documentPrefix: preset.documentPrefix });
  const similarityThreshold = effective.toolRouting?.similarityThreshold
    ?? preset?.similarityThreshold
    ?? DEFAULT_SIMILARITY_THRESHOLD;

  return {
    dialect: dialect as RagDialect,
    configPath: effective.configPath,
    allowedLangs: Array.isArray(effective.allowedLangs) && effective.allowedLangs.length > 0
      ? effective.allowedLangs
      : undefined,
    rewriteRoutingQuery: typeof config?.rewriteRoutingQuery === 'function' ? config.rewriteRoutingQuery : undefined,
    rewriteRoutingQueryOnMiss: typeof config?.rewriteRoutingQueryOnMiss === 'function' ? config.rewriteRoutingQueryOnMiss : undefined,
    routingTextVersion: typeof effective.routingTextVersion === 'string' ? effective.routingTextVersion : undefined,
    ensureSchema: effective.ensureSchema !== false,
    unmatchedRetentionDays: typeof effective.unmatchedRetentionDays === 'number' && effective.unmatchedRetentionDays > 0
      ? effective.unmatchedRetentionDays
      : undefined,
    knowledge,
    rag: {
      enabled: ragEnabled,
      embedding,
      queryEmbeddingCacheSize: effective.queryEmbeddingCacheSize ?? defaultRag.queryEmbeddingCacheSize,
      indexOnBoot: effective.indexOnBoot ?? defaultRag.indexOnBoot,
    },
    toolRouting: {
      ...defaultToolRouting,
      ...effective.toolRouting,
      similarityThreshold,
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
      RagDiagnosticsService,
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

  // The chatbot reads knowledge through this provider, with or without tool
  // routing; without routing it has no studio settings and is always on.
  if (knowledgeEnabled) {
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

  if (ragEnabled) builder.alias(RAG_DIAGNOSTICS, RagDiagnosticsService);

  if (routingEnabled) {
    builder.alias(TOOL_PROVIDER, ToolRouterService);
    const CHATBOT_ROUTING_PREVIEW_PROVIDER = Symbol.for('najm:chatbot:routing-preview-provider');
    builder.alias(CHATBOT_ROUTING_PREVIEW_PROVIDER, RoutingPreviewService);
  }

  if (knowledgeEnabled) {
    builder.alias(CHATBOT_CONTEXT_PROVIDER, KnowledgeContextProvider);
  }

  return builder.build();
};
