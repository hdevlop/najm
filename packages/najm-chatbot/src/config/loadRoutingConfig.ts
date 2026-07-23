import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { z } from 'zod';
import type { ChatbotConfig } from '../ChatbotPlugin';

const chatbotEmbeddingSchema = z.object({
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

const chatbotRoutingJsonSchema = z.object({
  mode: z.enum(['off', 'rag', 'routing']).optional(),
  chatLogging: z.boolean().optional(),
  embedding: chatbotEmbeddingSchema.optional(),
  maxTools: z.number().optional(),
  topSemanticHits: z.number().optional(),
  similarityThreshold: z.number().optional(),
  fallbackOnRouterError: z.enum(['all', 'none']).optional(),
  fallbackOnNoMatch: z.enum(['all', 'none']).optional(),
  dependencies: z.record(z.string(), z.array(z.string())).optional(),
  dangerousIntentKeywords: z.record(z.string(), z.array(z.string())).optional(),
  indexOnBoot: z.boolean().optional(),
  maxPromptMessages: z.number().optional(),
  maxStoredMessages: z.number().optional(),
  routingHistoryMessages: z.number().optional(),
});

export function loadChatbotRoutingConfig(configPath?: string): Partial<ChatbotConfig> {
  const envPath = process.env.CHATBOT_ROUTING_CONFIG_PATH;
  const targetPath = configPath
    ? isAbsolute(configPath)
      ? configPath
      : resolve(process.cwd(), configPath)
    : envPath
      ? resolve(envPath)
      : undefined;

  if (!targetPath || !existsSync(targetPath)) {
    if (envPath) {
      throw new Error(`CHATBOT_ROUTING_CONFIG_PATH points to missing file: ${envPath}`);
    }
    return {};
  }

  let raw: string;
  try {
    raw = readFileSync(targetPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read chatbot routing config from ${targetPath}: ${error}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in chatbot routing config (${targetPath}): ${error}`);
  }

  const validation = chatbotRoutingJsonSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Chatbot routing config validation failed (${targetPath}): ${issues}`);
  }

  const data = validation.data;

  // Map flat JSON to nested ChatbotConfig
  const result: Partial<ChatbotConfig> = {};

  if (data.mode !== undefined) {
    result.mode = data.mode;
  }

  if (data.chatLogging !== undefined) {
    result.chatLogging = { enabled: data.chatLogging };
  }

  if (data.embedding !== undefined || data.indexOnBoot !== undefined) {
    result.rag = {
      embedding: data.embedding,
      indexOnBoot: data.indexOnBoot,
    };
  }

  const toolRouting: NonNullable<ChatbotConfig['toolRouting']> = {};
  if (data.maxTools !== undefined) toolRouting.maxTools = data.maxTools;
  if (data.topSemanticHits !== undefined) toolRouting.topSemanticHits = data.topSemanticHits;
  if (data.similarityThreshold !== undefined) toolRouting.similarityThreshold = data.similarityThreshold;
  if (data.fallbackOnRouterError !== undefined) toolRouting.fallbackOnRouterError = data.fallbackOnRouterError;
  if (data.fallbackOnNoMatch !== undefined) toolRouting.fallbackOnNoMatch = data.fallbackOnNoMatch;
  if (data.dependencies !== undefined) toolRouting.dependencies = data.dependencies;
  if (data.dangerousIntentKeywords !== undefined) toolRouting.dangerousIntentKeywords = data.dangerousIntentKeywords;

  if (Object.keys(toolRouting).length > 0) {
    result.toolRouting = toolRouting;
  }

  if (data.maxPromptMessages !== undefined) {
    result.maxPromptMessages = data.maxPromptMessages;
  }

  if (data.maxStoredMessages !== undefined) {
    result.maxStoredMessages = data.maxStoredMessages;
  }

  if (data.routingHistoryMessages !== undefined) {
    result.routingHistoryMessages = data.routingHistoryMessages;
  }

  return result;
}
