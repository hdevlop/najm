import type { ChatDebugRequest, ChatDebugResponse, ChatDebugError } from './ChatDebugDto';

export const CHAT_DEBUG_PROVIDER = Symbol.for('najm:rag:chat-debug-provider');

export interface ChatDebugProvider {
  run(body: ChatDebugRequest): Promise<ChatDebugResponse | ChatDebugError>;
}