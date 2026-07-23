// ============================================================================
// ResendProvider.ts - Resend Email Provider
// ============================================================================

import { BaseProvider } from './BaseProvider';
import type {
  ResendConfig,
  EmailMessage,
  SendResult,
  BulkSendResult,
} from '../types';

interface ResendEmailPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  attachments?: {
    filename: string;
    content: string;
    content_type?: string;
  }[];
}

/**
 * Resend email provider
 * @see https://resend.com/docs
 */
export class ResendProvider extends BaseProvider {
  readonly name = 'resend';
  private baseUrl: string;

  constructor(private readonly config: ResendConfig) {
    super();
    this.baseUrl = config.baseUrl || 'https://api.resend.com';
  }

  async initialize(): Promise<void> {
    // Resend doesn't require initialization
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = this.buildPayload(message);

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return this.failure(data.message || 'Failed to send email', data);
      }

      return this.success(data.id, data);
    } catch (error) {
      return this.failure(error as Error);
    }
  }

  async sendBulk(messages: EmailMessage[]): Promise<BulkSendResult> {
    // Resend supports batch sending
    try {
      const payloads = messages.map((msg) => this.buildPayload(msg));

      const response = await fetch(`${this.baseUrl}/emails/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloads),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          total: messages.length,
          sent: 0,
          failed: messages.length,
          results: messages.map(() => this.failure(data.message || 'Batch send failed')),
        };
      }

      const results: SendResult[] = data.data.map((item: any) => {
        if (item.id) {
          return this.success(item.id, item);
        }
        return this.failure(item.message || 'Unknown error');
      });

      const sent = results.filter((r) => r.success).length;

      return {
        total: messages.length,
        sent,
        failed: messages.length - sent,
        results,
      };
    } catch (error) {
      return {
        total: messages.length,
        sent: 0,
        failed: messages.length,
        results: messages.map(() => this.failure(error as Error)),
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildPayload(message: EmailMessage): ResendEmailPayload {
    const payload: ResendEmailPayload = {
      from: message.from ? this.formatAddress(message.from) : '',
      to: this.extractEmails(message.to),
      subject: message.subject,
    };

    if (message.cc) {
      payload.cc = this.extractEmails(message.cc);
    }

    if (message.bcc) {
      payload.bcc = this.extractEmails(message.bcc);
    }

    if (message.replyTo) {
      payload.reply_to = [this.extractEmail(message.replyTo)];
    }

    if (message.text) {
      payload.text = message.text;
    }

    if (message.html) {
      payload.html = message.html;
    }

    if (message.headers) {
      payload.headers = message.headers;
    }

    if (message.tags) {
      payload.tags = message.tags.map((tag) => ({ name: tag, value: 'true' }));
    }

    if (message.attachments) {
      payload.attachments = message.attachments.map((att) => ({
        filename: att.filename,
        content:
          typeof att.content === 'string'
            ? att.content
            : att.content.toString('base64'),
        content_type: att.contentType,
      }));
    }

    return payload;
  }
}
