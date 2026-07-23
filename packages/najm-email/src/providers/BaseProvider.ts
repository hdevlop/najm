// ============================================================================
// BaseProvider.ts - Abstract Base Email Provider
// ============================================================================

import type {
  EmailProvider,
  EmailMessage,
  SendResult,
  BulkSendResult,
  EmailAddress,
} from '../types';

/**
 * Abstract base class for email providers
 * Provides common utilities and default implementations
 */
export abstract class BaseProvider implements EmailProvider {
  abstract readonly name: string;

  abstract initialize(): Promise<void>;
  abstract send(message: EmailMessage): Promise<SendResult>;

  /**
   * Default bulk send implementation (sequential)
   * Providers can override for optimized batch sending
   */
  async sendBulk(messages: EmailMessage[]): Promise<BulkSendResult> {
    const results: SendResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      total: messages.length,
      sent,
      failed,
      results,
    };
  }

  /**
   * Default verify implementation
   */
  async verify(): Promise<boolean> {
    return true;
  }

  /**
   * Default close implementation
   */
  async close(): Promise<void> {
    // Override in providers that need cleanup
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format email address to string
   */
  protected formatAddress(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      return address;
    }
    if (address.name) {
      return `"${address.name}" <${address.email}>`;
    }
    return address.email;
  }

  /**
   * Format email addresses array to string
   */
  protected formatAddresses(
    addresses: string | EmailAddress | (string | EmailAddress)[]
  ): string[] {
    if (!Array.isArray(addresses)) {
      return [this.formatAddress(addresses)];
    }
    return addresses.map((addr) => this.formatAddress(addr));
  }

  /**
   * Extract email from address
   */
  protected extractEmail(address: string | EmailAddress): string {
    if (typeof address === 'string') {
      // Handle "Name <email>" format
      const match = address.match(/<([^>]+)>/);
      return match ? match[1] : address;
    }
    return address.email;
  }

  /**
   * Extract emails from addresses array
   */
  protected extractEmails(
    addresses: string | EmailAddress | (string | EmailAddress)[]
  ): string[] {
    if (!Array.isArray(addresses)) {
      return [this.extractEmail(addresses)];
    }
    return addresses.map((addr) => this.extractEmail(addr));
  }

  /**
   * Generate a unique message ID
   */
  protected generateMessageId(domain?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const domainPart = domain || 'local';
    return `<${timestamp}.${random}@${domainPart}>`;
  }

  /**
   * Create success result
   */
  protected success(messageId?: string, response?: any): SendResult {
    return {
      success: true,
      messageId,
      response,
    };
  }

  /**
   * Create failure result
   */
  protected failure(error: string | Error, response?: any): SendResult {
    return {
      success: false,
      error: error instanceof Error ? error.message : error,
      response,
    };
  }
}
