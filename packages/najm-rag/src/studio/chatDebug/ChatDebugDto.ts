export interface ChatDebugRequest {
  message?: string;
  messages?: Array<{ id?: string; role: 'system' | 'user' | 'assistant'; content: string }>;
  sessionKey?: string;
  includeKnowledge?: boolean;
  includeRouting?: boolean;
  includeToolCalls?: boolean;
  traceOptions?: ChatDebugTraceOptions;
}

export interface ChatDebugTraceOptions {
  maxToolResultPreviewChars?: number;
  maxDepth?: number;
  maxArrayItems?: number;
  redactKeys?: string[];
}

export interface ChatDebugResponse {
  answer: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  routing?: ChatDebugRoutingTrace;
  knowledge?: ChatDebugKnowledgeTrace;
  toolCalls?: ChatDebugToolCall[];
  warnings?: ChatDebugWarning[];
}

export interface ChatDebugRoutingTrace {
  status: string;
  finalTools: string[];
  matches: Array<{ toolName: string; similarity: number; matchLevel: string }>;
  confirmations: Array<{ toolName: string; level: string; message?: string }>;
  dependencies: Array<{ toolName: string; reason: string }>;
}

export interface ChatDebugKnowledgeTrace {
  used: boolean;
  chunks: Array<{
    chunkId: string;
    documentId: string;
    text: string;
    score: number;
    source?: string | null;
  }>;
}

export interface ChatDebugToolCall {
  toolName: string;
  args: unknown;
  status: 'success' | 'error' | 'blocked';
  resultPreview?: unknown;
  error?: string;
}

export type ChatDebugWarningCode =
  | 'MISSING_ROUTED_TOOL_CALL'
  | 'EXPECTED_KNOWLEDGE_EMPTY'
  | 'LOW_ROUTING_CONFIDENCE'
  | 'MUTATING_TOOL_BLOCKED'
  | 'TOOL_RESULT_TRUNCATED';

export interface ChatDebugWarning {
  code: ChatDebugWarningCode;
  message: string;
}

export interface ChatDebugError {
  error: string;
  code: 'AI_DISABLED' | 'NO_PROVIDER' | 'NO_MODEL' | 'NO_TOOLS' | 'ROUTER_ERROR' | 'PROVIDER_ERROR';
  setup?: {
    needsProvider: boolean;
    needsModel: boolean;
    needsApiKey: boolean;
  };
}

export interface ChatDebugProvider {
  run(body: ChatDebugRequest): Promise<ChatDebugResponse | ChatDebugError>;
}
