import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { WHATSAPP_CONFIG } from './tokens';
import type { WhatsAppConfig, WhatsAppMediaType, WhatsAppSendResult } from './types';

const MAX_TEXT_LENGTH = 4096;

@Service()
@Meta({ layer: 'plugin' })
export class WhatsAppService {
  @Inject(WHATSAPP_CONFIG) private config!: WhatsAppConfig;
  @Inject(LoggerService) private log!: LoggerService;

  private get baseUrl(): string {
    const ver = this.config.apiVersion ?? 'v20.0';
    return `https://graph.facebook.com/${ver}/${this.config.phoneNumberId}/messages`;
  }

  private get headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async sendText(to: string, text: string): Promise<WhatsAppSendResult[]> {
    const chunks = this.chunkText(text);
    const results: WhatsAppSendResult[] = [];

    for (const chunk of chunks) {
      const result = await this.callApi({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: chunk },
      });
      results.push(result);
    }

    return results;
  }

  async sendTemplate(
    to: string,
    name: string,
    lang: string,
    params?: Array<{ type: string; text: string }>,
  ): Promise<WhatsAppSendResult> {
    const body: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: lang },
      },
    };

    if (params && params.length > 0) {
      body.template.components = [{
        type: 'body',
        parameters: params,
      }];
    }

    return this.callApi(body);
  }

  async sendMedia(
    to: string,
    type: WhatsAppMediaType,
    source: { url?: string; id?: string },
    caption?: string,
  ): Promise<WhatsAppSendResult> {
    const mediaObj: any = {};
    if (source.url) mediaObj.link = source.url;
    if (source.id) mediaObj.id = source.id;
    if (caption) mediaObj.caption = caption;

    return this.callApi({
      messaging_product: 'whatsapp',
      to,
      type,
      [type]: mediaObj,
    });
  }

  /**
   * Show the "typing…" indicator to the recipient. Meta's API ties this to
   * marking an inbound message as read, so `inboundMessageId` is required
   * (pass the `messageId` from the last @OnWhatsApp('message') event).
   * No-op (and best-effort) when `inboundMessageId` is missing.
   */
  async sendTyping(to: string, inboundMessageId?: string): Promise<void> {
    if (!inboundMessageId) {
      this.log.debug?.('sendTyping skipped: no inboundMessageId');
      return;
    }
    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: inboundMessageId,
          typing_indicator: { type: 'text' },
        }),
      });
    } catch {
      this.log.debug?.('Typing indicator failed (non-critical)');
    }
    // Parameter `to` is accepted for API symmetry; Meta routes the indicator
    // to the sender of `inboundMessageId` automatically.
    void to;
  }

  private async callApi(body: any): Promise<WhatsAppSendResult> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`WhatsApp API error ${res.status}: ${errorBody}`);
    }

    return res.json() as Promise<WhatsAppSendResult>;
  }

  private chunkText(text: string): string[] {
    if (text.length <= MAX_TEXT_LENGTH) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_TEXT_LENGTH) {
        chunks.push(remaining);
        break;
      }

      let splitAt = remaining.lastIndexOf('\n', MAX_TEXT_LENGTH);
      if (splitAt <= 0) splitAt = remaining.lastIndexOf(' ', MAX_TEXT_LENGTH);
      if (splitAt <= 0) splitAt = MAX_TEXT_LENGTH;

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }
}
