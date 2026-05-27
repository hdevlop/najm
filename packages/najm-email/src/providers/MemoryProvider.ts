// ============================================================================
// MemoryProvider.ts - Memory Email Provider (Testing)
// ============================================================================

import { BaseProvider } from './BaseProvider';
import type { MemoryConfig, EmailMessage, SendResult } from '../types';

interface StoredEmail {
  id: string;
  message: EmailMessage;
  sentAt: Date;
}

/**
 * Memory email provider for testing
 * Stores emails in memory for assertions
 */
export class MemoryProvider extends BaseProvider {
  readonly name = 'memory';
  
  /** Stored emails for testing */
  private emails: StoredEmail[] = [];

  constructor(_config: MemoryConfig) {
    super();
  }

  async initialize(): Promise<void> {
    this.emails = [];
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const messageId = this.generateMessageId('memory.test');

    this.emails.push({
      id: messageId,
      message: { ...message },
      sentAt: new Date(),
    });

    return this.success(messageId);
  }

  async verify(): Promise<boolean> {
    return true;
  }

  // ============================================================================
  // Test Utilities
  // ============================================================================

  /**
   * Get all sent emails
   */
  getSentEmails(): StoredEmail[] {
    return [...this.emails];
  }

  /**
   * Get email by message ID
   */
  getEmailById(messageId: string): StoredEmail | undefined {
    return this.emails.find((e) => e.id === messageId);
  }

  /**
   * Get emails sent to a specific address
   */
  getEmailsTo(email: string): StoredEmail[] {
    return this.emails.filter((e) => {
      const recipients = this.extractEmails(e.message.to);
      return recipients.includes(email);
    });
  }

  /**
   * Get emails with a specific subject
   */
  getEmailsBySubject(subject: string): StoredEmail[] {
    return this.emails.filter((e) => e.message.subject === subject);
  }

  /**
   * Get emails containing text in subject or body
   */
  searchEmails(text: string): StoredEmail[] {
    const lowerText = text.toLowerCase();
    return this.emails.filter((e) => {
      const subject = e.message.subject.toLowerCase();
      const textContent = (e.message.text || '').toLowerCase();
      const htmlContent = (e.message.html || '').toLowerCase();
      return (
        subject.includes(lowerText) ||
        textContent.includes(lowerText) ||
        htmlContent.includes(lowerText)
      );
    });
  }

  /**
   * Get the last sent email
   */
  getLastEmail(): StoredEmail | undefined {
    return this.emails[this.emails.length - 1];
  }

  /**
   * Get count of sent emails
   */
  getEmailCount(): number {
    return this.emails.length;
  }

  /**
   * Clear all stored emails
   */
  clear(): void {
    this.emails = [];
  }

  /**
   * Assert that an email was sent to a specific address
   */
  assertSentTo(email: string): boolean {
    return this.getEmailsTo(email).length > 0;
  }

  /**
   * Assert that an email with specific subject was sent
   */
  assertSentWithSubject(subject: string): boolean {
    return this.getEmailsBySubject(subject).length > 0;
  }
}
