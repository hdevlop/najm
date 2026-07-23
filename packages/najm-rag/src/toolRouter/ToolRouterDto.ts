import { z } from 'zod';
import type { RegisteredTool } from 'najm-mcp';
import type { RagToolRoutingConfig } from '../config';

export interface CachedRouting {
  config: RagToolRoutingConfig;
  mtime: number;
  loadedAt: number;
}

export interface ToolRouterResult {
  status: 'disabled' | 'routed' | 'fallback_all' | 'fallback_none' | 'router_error';
  tools: RegisteredTool[];
  error?: string;
}

export interface RoutingPreviewMatch {
  toolName: string;
  similarity: number;
  source: 'semantics' | 'embeddings';
}

export interface RoutingPreviewDependency {
  toolName: string;
  reason: string;
}

export interface RoutingPreviewToolScore {
  toolName: string;
  similarity: number;
  source: 'semantics' | 'embeddings';
  matchLevel: 'primary' | 'secondary' | 'below_threshold';
}

export interface RoutingPreviewRoutingDecision {
  toolName: string;
  kept: boolean;
  reason: 'primary' | 'dependency' | 'read_only' | 'dropped_as_alternative';
}

export interface RoutingPreviewConfirmation {
  toolName: string;
  level: 'notice' | 'warning' | 'danger';
  message?: string;
  resolvedMessage?: string;
}

export interface RoutingPreviewConfig {
  maxTools: number;
  topSemanticHits: number;
  similarityThreshold: number;
  fallbackOnNoMatch: string;
  fallbackOnRouterError: string;
}

export interface RoutingPreviewResult {
  query: string;
  normalized: string;
  status: 'disabled' | 'routed' | 'fallback_all' | 'fallback_none' | 'router_error';
  matches: RoutingPreviewMatch[];
  finalToolScores?: RoutingPreviewToolScore[];
  dependencies: RoutingPreviewDependency[];
  routingDecisions: RoutingPreviewRoutingDecision[];
  confirmations: RoutingPreviewConfirmation[];
  finalTools: string[];
  error?: string;
  config: RoutingPreviewConfig;
}

export interface ChatbotRoutingConfigProvider {
  getRoutingConfig(): Promise<RagToolRoutingConfig>;
}

// Legacy schemas kept for backward compatibility
export const chatbotEmbeddingSchema = z.object({
  baseUrl: z.string().optional(),
  model: z.string().optional(),
});

export const chatbotRagSchema = z.object({
  enabled: z.boolean().optional(),
  embedding: chatbotEmbeddingSchema.optional(),
  queryEmbeddingCacheSize: z.number().optional(),
  indexOnBoot: z.boolean().optional(),
});

export const chatbotToolRoutingSchema = z.object({
  enabled: z.boolean().optional(),
  maxTools: z.number().optional(),
  topSemanticHits: z.number().optional(),
  similarityThreshold: z.number().optional(),
  fallbackOnRouterError: z.enum(['all', 'none']).optional(),
  fallbackOnNoMatch: z.enum(['all', 'none']).optional(),
  dependencies: z.record(z.string(), z.array(z.string())).optional(),
});

export const chatbotLoggingSchema = z.object({
  enabled: z.boolean().optional(),
});

// Flat JSON schema for routing.json (post-Part A)
export const chatbotRoutingJsonSchema = z.object({
  mode: z.enum(['off', 'rag', 'routing']).optional(),
  chatLogging: z.boolean().optional(),
  embedding: chatbotEmbeddingSchema.optional(),
  maxTools: z.number().optional(),
  topSemanticHits: z.number().optional(),
  similarityThreshold: z.number().optional(),
  fallbackOnRouterError: z.enum(['all', 'none']).optional(),
  fallbackOnNoMatch: z.enum(['all', 'none']).optional(),
  dependencies: z.record(z.string(), z.array(z.string())).optional(),
  indexOnBoot: z.boolean().optional(),
});
