import { createHmac, timingSafeEqual } from 'crypto';
import { Controller, Get, Post, Query, Ctx } from 'najm-core';
import { Inject, LoggerService } from 'najm-core';
import { EventService } from 'najm-event';
import { WHATSAPP_CONFIG } from './tokens';
import type { WhatsAppConfig, WhatsAppIncomingMessage, WhatsAppStatusEvent } from './types';
import type { Context } from 'hono';

@Controller('/whatsapp')
export class WhatsAppController {
  @Inject(WHATSAPP_CONFIG) private config!: WhatsAppConfig;
  @Inject(LoggerService) private log!: LoggerService;
  @Inject(EventService) private events!: EventService;

  @Get('/webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Ctx() ctx: Context,
  ) {
    if (mode === 'subscribe' && token === this.config.verifyToken) {
      this.log.info('WhatsApp webhook verified');
      return ctx.text(challenge);
    }
    return ctx.json({ error: 'Forbidden' }, 403);
  }

  @Post('/webhook')
  async webhook(@Ctx() ctx: Context) {
    const rawBody = await ctx.req.text();
    if (!this.verifySignature(ctx, rawBody)) {
      this.log.warn('WhatsApp webhook: invalid signature');
      return ctx.json({ error: 'Invalid signature' }, 401);
    }

    const parsed = JSON.parse(rawBody);

    if (parsed?.object !== 'whatsapp_business_account') {
      return ctx.json({ ok: true }, 200);
    }

    const entries = parsed?.entry ?? [];
    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        if (value.messages && Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const incoming = this.parseIncomingMessage(msg, value.contacts);
            this.events.emit('whatsapp.message', incoming);
          }
        }

        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const statusEvent = this.parseStatusEvent(status);
            this.events.emit('whatsapp.status', statusEvent);
          }
        }
      }
    }

    return ctx.json({ ok: true }, 200);
  }

  verifySignature(ctx: Context, rawBody: string): boolean {
    const sig = ctx.req.header('x-hub-signature-256');
    if (!sig || !sig.startsWith('sha256=')) return false;

    const expected = sig.slice('sha256='.length);
    const hmac = createHmac('sha256', this.config.webhookSecret);
    hmac.update(rawBody);
    const computed = hmac.digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }

  private parseIncomingMessage(msg: any, contacts?: any[]): WhatsAppIncomingMessage {
    let text = '';
    if (msg.text?.body) text = msg.text.body;
    else if (msg.button?.text) text = msg.button.text;
    else if (msg.interactive?.button_reply?.title) text = msg.interactive.button_reply.title;
    else if (msg.interactive?.list_reply?.title) text = msg.interactive.list_reply.title;

    return {
      from: msg.from ?? '',
      text,
      messageId: msg.id ?? '',
      timestamp: msg.timestamp ?? '',
      type: msg.type ?? 'unknown',
      raw: msg,
    };
  }

  private parseStatusEvent(status: any): WhatsAppStatusEvent {
    return {
      from: status.recipient_id ?? '',
      messageId: status.id ?? '',
      status: status.status ?? 'unknown',
      timestamp: status.timestamp ?? '',
      raw: status,
    };
  }
}
