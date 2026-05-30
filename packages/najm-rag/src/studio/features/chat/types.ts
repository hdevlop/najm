// owner: chat (used by knowledge, routing-lab, app)

import type { RoutingPreviewResult } from './routing-semantics/types';

// Chat domain types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  timestamp: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  ordinal: number;
  sourceType: string;
}

// Chat debug types
export interface StudioChatDebugRequest {
  message?: string;
  messages?: Array<{ id?: string; role: 'system' | 'user' | 'assistant'; content: string }>;
  sessionKey?: string;
  includeKnowledge?: boolean;
  includeRouting?: boolean;
  includeToolCalls?: boolean;
  traceOptions?: {
    maxToolResultPreviewChars?: number;
    maxDepth?: number;
    maxArrayItems?: number;
    redactKeys?: string[];
  };
}

export interface StudioChatDebugResponse {
  answer: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  routing?: RoutingPreviewResult;
  knowledge?: {
    used: boolean;
    chunks: Array<{
      chunkId: string;
      documentId: string;
      text: string;
      score: number;
      source?: string | null;
    }>;
  };
  toolCalls?: Array<{
    toolName: string;
    args: unknown;
    status: 'success' | 'error' | 'blocked';
    resultPreview?: unknown;
    error?: string;
  }>;
  warnings?: Array<{
    code: string;
    message: string;
  }>;
}

export interface StudioChatDebugError {
  error: string;
  code: string;
  setup?: {
    needsProvider: boolean;
    needsModel: boolean;
    needsApiKey: boolean;
  };
}

// Re-exports
export type { PendingRoutingLabQuery, PendingTestDraft, PendingSemanticDraft } from '../../lib/chatDraftsContext';
export type { MCPTool } from './routing-tools/types';
export type { SemanticPhraseResponse } from './routing-semantics/types';