// owner: assistant (used by routing-semantics, routing-tests, routing-tools, knowledge, settings)

export type StudioAssistantView =
  | 'routing-semantics'
  | 'routing-tests'
  | 'routing-tools'
  | 'knowledge'
  | 'settings';

export type StudioAssistantEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown; requiresConfirmation?: boolean }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; result?: unknown; error?: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; message: string };

export interface StudioAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: StudioAssistantToolCall[];
}

export interface StudioAssistantToolCall {
  id: string;
  name: string;
  args: unknown;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
}

// Re-export from constants so barrel index.ts can reach RefreshBucket via types
export type { RefreshBucket } from './constants';