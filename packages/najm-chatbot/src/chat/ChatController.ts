import { Controller, Post, Body, Ctx, Inject } from 'najm-core';
import { isAuth } from 'najm-auth';
import type { Context } from 'hono';
import { ChatAgent } from '../agent/ChatAgent';
import { CHATBOT_CONFIG } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { chatRequestSchema } from './ChatRequestDto';

@Controller('/chat')
export class ChatController {
  private schema?: ReturnType<typeof chatRequestSchema>;

  constructor(
    private agent: ChatAgent,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
  ) {}

  @Post()
  @isAuth()
  async chat(@Body() body: unknown, @Ctx() ctx: Context) {
    this.schema ??= chatRequestSchema(this.config?.chatRequestLimits);
    const parsed = this.schema.safeParse(body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue?.path[0] === 'messages' && issue.code === 'invalid_type'
        ? 'Messages array is required.'
        : `${issue?.path.join('.') || 'body'}: ${issue?.message ?? 'invalid request'}`;
      return ctx.json({ error: message }, 400);
    }

    const sessionKey = parsed.data.sessionKey?.trim() ? parsed.data.sessionKey : undefined;
    return this.agent.stream({ messages: parsed.data.messages as any[], sessionKey, channel: 'web', signal: ctx.req.raw.signal });
  }
}
