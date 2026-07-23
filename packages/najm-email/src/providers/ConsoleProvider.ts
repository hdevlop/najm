// ============================================================================
// ConsoleProvider.ts - Console Email Provider (Development/Testing)
// ============================================================================

import { BaseProvider } from './BaseProvider';
import type { ConsoleConfig, EmailMessage, SendResult } from '../types';

/**
 * Console email provider for development and testing
 * Logs emails to console instead of sending them
 */
export class ConsoleProvider extends BaseProvider {
  readonly name = 'console';
  private logLevel: 'info' | 'debug';

  constructor(config: ConsoleConfig) {
    super();
    this.logLevel = config.logLevel || 'info';
  }

  async initialize(): Promise<void> {
    console.log('[Email:Console] Provider initialized');
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = this.generateMessageId('console.local');

    const formattedMessage = this.formatEmailForConsole(message, messageId);

    if (this.logLevel === 'debug') {
      console.log('[Email:Console] Full message object:', JSON.stringify(message, null, 2));
    }

    console.log(formattedMessage);

    return this.success(messageId);
  }

  async verify(): Promise<boolean> {
    return true;
  }

  private formatEmailForConsole(message: EmailMessage, messageId: string): string {
    const separator = '═'.repeat(60);
    const lines: string[] = [
      '',
      separator,
      '📧 EMAIL (Console Provider)',
      separator,
      `Message-ID: ${messageId}`,
      `From: ${message.from ? this.formatAddress(message.from) : 'Not specified'}`,
      `To: ${this.formatAddresses(message.to).join(', ')}`,
    ];

    if (message.cc) {
      lines.push(`CC: ${this.formatAddresses(message.cc).join(', ')}`);
    }

    if (message.bcc) {
      lines.push(`BCC: ${this.formatAddresses(message.bcc).join(', ')}`);
    }

    if (message.replyTo) {
      lines.push(`Reply-To: ${this.formatAddress(message.replyTo)}`);
    }

    lines.push(`Subject: ${message.subject}`);
    lines.push('─'.repeat(60));

    if (message.text) {
      lines.push('TEXT CONTENT:');
      lines.push(message.text);
      lines.push('');
    }

    if (message.html) {
      lines.push('HTML CONTENT:');
      lines.push(this.truncateHtml(message.html));
      lines.push('');
    }

    if (message.attachments && message.attachments.length > 0) {
      lines.push('ATTACHMENTS:');
      for (const att of message.attachments) {
        const size = typeof att.content === 'string' 
          ? att.content.length 
          : att.content.length;
        lines.push(`  - ${att.filename} (${att.contentType || 'unknown'}, ${this.formatSize(size)})`);
      }
      lines.push('');
    }

    if (message.tags && message.tags.length > 0) {
      lines.push(`Tags: ${message.tags.join(', ')}`);
    }

    lines.push(separator);
    lines.push('');

    return lines.join('\n');
  }

  private truncateHtml(html: string, maxLength: number = 500): string {
    if (html.length <= maxLength) {
      return html;
    }
    return `${html.substring(0, maxLength)}... [truncated, ${html.length} chars total]`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
