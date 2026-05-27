// ============================================================================
// SmtpProvider.ts - SMTP Email Provider
// ============================================================================

import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { BaseProvider } from './BaseProvider';
import type { SmtpConfig, EmailMessage, SendResult } from '../types';

/**
 * SMTP email provider using nodemailer
 */
export class SmtpProvider extends BaseProvider {
  readonly name = 'smtp';
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: SmtpConfig) {
    super();
  }

  async initialize(): Promise<void> {
    const options: nodemailer.TransportOptions = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? this.config.port === 465,
      auth: this.config.auth,
      tls: this.config.tls,
      pool: this.config.pool,
      maxConnections: this.config.maxConnections,
      maxMessages: this.config.maxMessages,
    } as nodemailer.TransportOptions;

    this.transporter = nodemailer.createTransport(options);
  }

  async send(message: EmailMessage): Promise<SendResult> {
    if (!this.transporter) {
      return this.failure('SMTP transporter not initialized');
    }

    try {
      const mailOptions: Mail.Options = {
        from: message.from ? this.formatAddress(message.from) : undefined,
        to: this.formatAddresses(message.to),
        cc: message.cc ? this.formatAddresses(message.cc) : undefined,
        bcc: message.bcc ? this.formatAddresses(message.bcc) : undefined,
        replyTo: message.replyTo ? this.formatAddress(message.replyTo) : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.headers,
        priority: this.mapPriority(message.priority),
        attachments: message.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid,
          contentDisposition: att.disposition,
          encoding: att.encoding,
        })),
      };

      const result = await this.transporter.sendMail(mailOptions);

      return this.success(result.messageId, result);
    } catch (error) {
      return this.failure(error as Error);
    }
  }

  async verify(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }

  private mapPriority(priority?: 1 | 3 | 5): 'high' | 'normal' | 'low' | undefined {
    if (!priority) return undefined;
    switch (priority) {
      case 1:
        return 'high';
      case 3:
        return 'normal';
      case 5:
        return 'low';
      default:
        return 'normal';
    }
  }
}
