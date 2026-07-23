import { plugin } from 'najm-core';
import { events } from 'najm-event';
import { CHATBOT_CONFIG, CHATBOT_SCHEMA } from './tokens';
import * as AiSettingsModule from './ai-settings';
import * as SessionsModule from './sessions';
import { ChatAgent } from './agent/ChatAgent';
import { ChatController } from './chat/ChatController';
import { ChatDebugController } from './chat/ChatDebugController';
import { ChatSessionController } from './chat/ChatSessionController';
import { ChatLogRepository } from './chatLogs';
import { chatbotCoreSchema as sqliteSchema } from './schema/internal/sqlite';
import { chatbotCoreSchema as pgSchema } from './schema/internal/pg';
import { chatbotCoreSchema as mysqlSchema } from './schema/internal/mysql';
import { loadChatbotRoutingConfig } from './config/loadRoutingConfig';
import type { ChatbotSchema } from './ai-settings';

export type ChatbotDialect = 'sqlite' | 'pg' | 'mysql';

export type ToolRoutingFallback = 'all' | 'none';

export interface ChatbotRagConfig {
  enabled?: boolean;
  embedding?: {
    provider?: 'ollama';
    baseUrl?: string;
    model?: string;
    dimensions?: number;
  };
  queryEmbeddingCacheSize?: number;
  indexOnBoot?: boolean;
}

export interface ChatbotToolRoutingConfig {
  enabled?: boolean;
  maxTools?: number;
  topSemanticHits?: number;
  similarityThreshold?: number;
  fallbackOnRouterError?: ToolRoutingFallback;
  fallbackOnNoMatch?: ToolRoutingFallback;
  dependencies?: Record<string, string[]>;
  dangerousIntentKeywords?: Record<string, string[]>;
}

export interface ChatbotLoggingConfig {
  enabled?: boolean;
}

export interface ChatbotConfig {
  configPath?: string;
  mode?: 'off' | 'rag' | 'routing';
  dialect?: ChatbotDialect;
  schema?: ChatbotSchema;
  defaultSystemPrompt?: string;
  maxSteps?: number;
  maxPromptMessages?: number;
  maxStoredMessages?: number;
  routingHistoryMessages?: number;
  systemPromptByChannel?: { web?: string; whatsapp?: string };
  conversationStore?: 'db' | 'cache';
  sessionTtl?: number;
  rag?: ChatbotRagConfig;
  toolRouting?: ChatbotToolRoutingConfig;
  chatLogging?: ChatbotLoggingConfig;
  /** @deprecated Use `rag({ toolRouting: { enabled: true } })` + plain `chatbot()` instead. */
  tools?: 'none' | 'all';
  /** @deprecated Use `rag({ knowledge: true })` + plain `chatbot()` instead. */
  context?: 'none';
}

const defaultRag: Required<ChatbotRagConfig> = {
  enabled: false,
  embedding: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'embeddinggemma',
    dimensions: 768,
  },
  queryEmbeddingCacheSize: 256,
  indexOnBoot: true,
};

const defaultToolRouting: Required<ChatbotToolRoutingConfig> = {
  enabled: false,
  maxTools: 12,
  topSemanticHits: 8,
  similarityThreshold: 0.45,
  fallbackOnRouterError: 'all',
  fallbackOnNoMatch: 'none',
  dependencies: {},
  dangerousIntentKeywords: {},
};

const defaultChatLogging: Required<ChatbotLoggingConfig> = {
  enabled: true,
};

const warnedKeys = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (process.env.NAJM_NO_DEPRECATION_WARNINGS === '1') return;
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[najm-chatbot deprecation] ${message}`);
}

const resolveSchema = (config?: ChatbotConfig): ChatbotSchema => {
  if (config?.schema) return config.schema;
  if (config?.dialect === 'sqlite') return sqliteSchema;
  if (config?.dialect === 'mysql') return mysqlSchema;
  return pgSchema;
};

const mergeConfig = (config?: ChatbotConfig): ChatbotConfig => {
  const jsonConfig = config?.configPath ? loadChatbotRoutingConfig(config.configPath) : {};
  const hasDeprecatedRagConfig = !!(
    config?.rag ||
    config?.toolRouting ||
    jsonConfig.rag ||
    jsonConfig.toolRouting
  );

  // TS options win over JSON
  const effective: ChatbotConfig = {
    ...jsonConfig,
    ...config,
    rag: {
      ...(jsonConfig.rag ?? {}),
      ...(config?.rag ?? {}),
      embedding: {
        ...(jsonConfig.rag?.embedding ?? {}),
        ...(config?.rag?.embedding ?? {}),
      },
    },
    toolRouting: {
      ...(jsonConfig.toolRouting ?? {}),
      ...(config?.toolRouting ?? {}),
    },
    chatLogging: {
      ...(jsonConfig.chatLogging ?? {}),
      ...(config?.chatLogging ?? {}),
    },
  };

  if (effective.mode && effective.tools) {
    throw new Error('Use `tools` only — `mode` is deprecated.');
  }

  if (effective.mode) {
    warnOnce(
      'chatbot-mode',
      '`chatbot({ mode: ... })` is deprecated. Use the `rag()` plugin instead: `rag({ toolRouting: { enabled: true } })` + plain `chatbot()`.',
    );
  }

  if (hasDeprecatedRagConfig) {
    warnOnce(
      'chatbot-rag-config',
      '`chatbot({ rag: ..., toolRouting: ... })` is deprecated. Move RAG config to the `rag()` plugin.',
    );
  }

  const toolRouting = effective.toolRouting;
  const dialect = effective.dialect ?? 'pg';

  // Backward compatibility: migrate old toolRouting.embedding/queryEmbeddingCacheSize/indexOnBoot to rag
  const oldToolRouting = toolRouting as any;
  const ragEmbedding = effective.rag?.embedding ?? oldToolRouting?.embedding;
  const ragQueryCacheSize = effective.rag?.queryEmbeddingCacheSize ?? oldToolRouting?.queryEmbeddingCacheSize;
  const ragIndexOnBoot = effective.rag?.indexOnBoot ?? oldToolRouting?.indexOnBoot;

  // Derive rag/toolRouting enabled from mode (A7) or fall back to explicit flags
  let ragEnabled: boolean;
  let routingEnabled: boolean;

  if (effective.mode) {
    ragEnabled = effective.mode !== 'off';
    routingEnabled = effective.mode === 'routing';
  } else {
    ragEnabled = effective.rag?.enabled ?? toolRouting?.enabled ?? false;
    routingEnabled = toolRouting?.enabled === true;
  }

  const rag: Required<ChatbotRagConfig> = {
    enabled: ragEnabled,
    embedding: {
      ...defaultRag.embedding,
      ...ragEmbedding,
    },
    queryEmbeddingCacheSize: ragQueryCacheSize ?? defaultRag.queryEmbeddingCacheSize,
    indexOnBoot: ragIndexOnBoot ?? defaultRag.indexOnBoot,
  };

  return {
    configPath: effective.configPath,
    mode: effective.mode,
    dialect,
    defaultSystemPrompt: effective.defaultSystemPrompt ?? '',
    maxSteps: effective.maxSteps ?? 10,
    maxPromptMessages: effective.maxPromptMessages ?? 10,
    maxStoredMessages: effective.maxStoredMessages ?? 100,
    routingHistoryMessages: effective.routingHistoryMessages ?? 2,
    systemPromptByChannel: effective.systemPromptByChannel ?? {},
    conversationStore: effective.conversationStore ?? 'db',
    sessionTtl: effective.sessionTtl,
    rag,
    toolRouting: {
      ...defaultToolRouting,
      ...toolRouting,
      enabled: routingEnabled,
    },
    chatLogging: {
      ...defaultChatLogging,
      ...effective.chatLogging,
    },
    tools: effective.tools,
    context: effective.context,
  };
};

export const chatbot = (config?: ChatbotConfig) => {
  const merged = mergeConfig(config);
  const services: any[] = [
    AiSettingsModule,
    SessionsModule,
    ChatAgent,
    ChatController,
    ChatDebugController,
    ChatSessionController,
    ChatLogRepository,
  ];

  const needsMcp = merged.toolRouting?.enabled === true || merged.tools === 'all';

  return plugin('chatbot')
    .version('1.0.0')
    .depends(events())
    .requires(...(needsMcp ? ['auth', 'database', 'mcp'] : ['auth', 'database']))
    .services(...services)
    .config(CHATBOT_CONFIG, merged)
    .set(CHATBOT_SCHEMA, resolveSchema(config))
    .build();
};
