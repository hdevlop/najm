// ============================================================================
// SendGridProvider.ts - SendGrid Email Provider
// ============================================================================

import { BaseProvider } from './BaseProvider';
import type {
  SendGridConfig,
  EmailMessage,
  SendResult,
  BulkSendResult,
  EmailAddress,
} from '../types';

interface SendGridPersonalization {
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject?: string;
}

interface SendGridPayload {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content?: { type: string; value: string }[];
  attachments?: {
    content: string;
    filename: string;
    type?: string;
    disposition?: string;
    content_id?: string;
  }[];
  headers?: Record<string, string>;
  categories?: string[];
  mail_settings?: {
    sandbox_mode?: { enable: boolean };
  };
}

/**
 * SendGrid email provider
 * @see https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
export class SendGridProvider extends BaseProvider {
  readonly name = 'sendgrid';
  private readonly baseUrl = 'https://api.sendgrid.com/v3';

  constructor(private readonly config: SendGridConfig) {
    super();
  }

  async initialize(): Promise<void> {
    // SendGrid doesn't require initialization
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const payload = this.buildPayload(message);

      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return this.failure(
          errorData.errors?.[0]?.message || `HTTP ${response.status}`,
          errorData
        );
      }

      // SendGrid returns 202 Accepted with message ID in header
      const messageId = response.headers.get('X-Message-Id');

      return this.success(messageId || undefined);
    } catch (error) {
      return this.failure(error as Error);
    }
  }

  async sendBulk(messages: EmailMessage[]): Promise<BulkSendResult> {
    // SendGrid supports multiple personalizations in a single request
    // But for different content, we need separate requests
    return super.sendBulk(messages);
  }

  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
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

  private buildPayload(message: EmailMessage): SendGridPayload {
    const personalization: SendGridPersonalization = {
      to: this.toSendGridRecipients(message.to),
    };

    if (message.cc) {
      personalization.cc = this.toSendGridRecipients(message.cc);
    }

    if (message.bcc) {
      personalization.bcc = this.toSendGridRecipients(message.bcc);
    }

    const payload: SendGridPayload = {
      personalizations: [personalization],
      from: this.toSendGridAddress(message.from || ''),
      subject: message.subject,
    };

    if (message.replyTo) {
      payload.reply_to = this.toSendGridAddress(message.replyTo);
    }

    // Build content array
    const content: { type: string; value: string }[] = [];
    if (message.text) {
      content.push({ type: 'text/plain', value: message.text });
    }
    if (message.html) {
      content.push({ type: 'text/html', value: message.html });
    }
    if (content.length > 0) {
      payload.content = content;
    }

    if (message.attachments) {
      payload.attachments = message.attachments.map((att) => ({
        content:
          typeof att.content === 'string'
            ? att.content
            : att.content.toString('base64'),
        filename: att.filename,
        type: att.contentType,
        disposition: att.disposition,
        content_id: att.cid,
      }));
    }

    if (message.headers) {
      payload.headers = message.headers;
    }

    if (message.tags) {
      payload.categories = message.tags;
    }

    if (this.config.sandboxMode) {
      payload.mail_settings = {
        sandbox_mode: { enable: true },
      };
    }

    return payload;
  }

  private toSendGridAddress(address: string | EmailAddress): {
    email: string;
    name?: string;
  } {
    if (typeof address === 'string') {
      return { email: address };
    }
    return { email: address.email, name: address.name };
  }

  private toSendGridRecipients(
    addresses: string | EmailAddress | (string | EmailAddress)[]
  ): { email: string; name?: string }[] {
    if (!Array.isArray(addresses)) {
      return [this.toSendGridAddress(addresses)];
    }
    return addresses.map((addr) => this.toSendGridAddress(addr));
  }
}
