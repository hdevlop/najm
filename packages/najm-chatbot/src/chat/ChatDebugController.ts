import { Body, Controller, Post } from 'najm-core';
import { isAdmin } from 'najm-auth';
import type { ChatDebugRequest, ChatDebugTraceOptions } from 'najm-rag';
import { ChatAgent } from '../agent/ChatAgent';
import type {
  ChatAgentDebugInput,
  ChatDebugError,
  ChatDebugResponse,
} from '../agent/ChatAgent';

const DEFAULT_TRACE_OPTIONS: ChatDebugTraceOptions = {
  maxToolResultPreviewChars: 500,
  maxDepth: 5,
  maxArrayItems: 10,
  redactKeys: ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'],
};

function createDebugSessionKey(): string {
  return `debug:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function createDebugMessageId(index: number): string {
  return `debug-msg:${Date.now().toString(36)}:${index}:${Math.random().toString(36).slice(2)}`;
}

@Controller('/rag-studio/chat-debug')
@isAdmin()
export class ChatDebugController {
  constructor(private agent: ChatAgent) {}

  @Post()
  async debug(@Body() body: ChatDebugRequest): Promise<ChatDebugResponse | ChatDebugError> {
    if (!body?.message && (!body?.messages || body.messages.length === 0)) {
      return {
        error: 'Either message or messages must be provided.',
        code: 'PROVIDER_ERROR',
      };
    }

    const messages = body.messages?.length
      ? body.messages
      : [{ role: 'user' as const, content: body.message ?? '' }];

    const sessionKey = typeof body.sessionKey === 'string' && body.sessionKey.trim()
      ? body.sessionKey.trim()
      : createDebugSessionKey();

    const input: ChatAgentDebugInput = {
      messages: messages.map((message, index) => ({
        ...message,
        id: message.id ?? createDebugMessageId(index),
      })) as ChatAgentDebugInput['messages'],
      sessionKey,
      channel: 'web',
      traceOptions: {
        ...DEFAULT_TRACE_OPTIONS,
        ...body.traceOptions,
      },
    };

    return this.agent.debugRun(input);
  }
}
