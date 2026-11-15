import { z } from 'zod';

export interface ChatRequestLimits {
  /** Most messages one request may carry. Defaults to 200. */
  maxMessages?: number;
  /** Most text characters in one message. Defaults to 32000. */
  maxMessageChars?: number;
}

export const DEFAULT_CHAT_REQUEST_LIMITS: Required<ChatRequestLimits> = {
  maxMessages: 200,
  maxMessageChars: 32_000,
};

const textOf = (message: { content?: unknown; parts?: unknown }): string => {
  if (typeof message.content === 'string') return message.content;
  const parts = Array.isArray(message.parts) ? message.parts : Array.isArray(message.content) ? message.content : [];
  return parts.map((part: any) => (part?.type === 'text' && typeof part.text === 'string' ? part.text : '')).join('');
};

/**
 * The body of `POST /chat`. The system prompt is the server's: clients may
 * send only user and assistant messages, in the AI SDK shape (`parts`) or the
 * legacy one (`content`). Extra fields the AI SDK client adds are allowed.
 */
export function chatRequestSchema(limits: ChatRequestLimits = {}) {
  const { maxMessages, maxMessageChars } = { ...DEFAULT_CHAT_REQUEST_LIMITS, ...limits };
  const message = z.object({
    id: z.string().max(200).optional(),
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(z.any())]).optional(),
    parts: z.array(z.any()).optional(),
  }).passthrough().refine(
    (value) => textOf(value).length <= maxMessageChars,
    { message: `A message may have at most ${maxMessageChars} characters` },
  );
  return z.object({
    messages: z.array(message).min(1, 'Messages array is required.').max(maxMessages),
    sessionKey: z.string().max(255).optional(),
  }).passthrough();
}
