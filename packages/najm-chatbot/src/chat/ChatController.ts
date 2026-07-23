import { Controller, Post, Body, Ctx } from 'najm-core';
import { isAuth } from 'najm-auth';
import type { Context } from 'hono';
import { ChatAgent } from '../agent/ChatAgent';

interface ChatRequest {
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }>; [key: string]: unknown }>;
  sessionKey?: string;
}

@Controller('/chat')
export class ChatController {
  constructor(private agent: ChatAgent) {}

  @Post()
  @isAuth()
  async chat(@Body() body: ChatRequest, @Ctx() ctx: Context) {
    if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return ctx.json({ error: 'Messages array is required.' }, 400);
    }

    const messages = body.messages as any[];
    const sessionKey = typeof body.sessionKey === 'string' && body.sessionKey.trim()
      ? body.sessionKey
      : undefined;
    return this.agent.stream({ messages, sessionKey, channel: 'web' });
  }
}
