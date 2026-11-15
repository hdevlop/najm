import { Controller, Post, Body, Ctx, DI, type Container } from 'najm-core';
import { isAuth } from 'najm-auth';
import type { Context } from 'hono';
import { ChatAgent } from '../agent/ChatAgent';
import { CHATBOT_CONFIG } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { chatRequestSchema, type ChatRequestLimits } from './ChatRequestDto';

@Controller('/chat')
export class ChatController {
  /**
   * chatbot() registers its config; an app that loads this controller on its
   * own has none, so the config is looked up, not injected, and the default
   * request limits apply.
   */
  @DI() private container?: Container;
  private schema?: ReturnType<typeof chatRequestSchema>;

  constructor(private agent: ChatAgent) {}

  private requestLimits(): ChatRequestLimits | undefined {
    if (!this.container?.has(CHATBOT_CONFIG)) return undefined;
    return (this.container.get(CHATBOT_CONFIG) as ChatbotConfig | undefined)?.chatRequestLimits;
  }

  @Post()
  @isAuth()
  async chat(@Body() body: unknown, @Ctx() ctx: Context) {
    this.schema ??= chatRequestSchema(this.requestLimits());
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
