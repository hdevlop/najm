// ============================================================================
// EmailService.ts - Main Email Service
// ============================================================================

import { Service, Meta, Inject, DI, Container } from 'najm-core';
import { Err, LoggerService } from 'najm-core';
import { EMAIL_CONFIG, EMAIL_PROVIDER } from './tokens';
import {
  SmtpProvider,
  ResendProvider,
  SendGridProvider,
  ConsoleProvider,
  MemoryProvider,
} from './providers';
import type {
  EmailConfig,
  EmailMessage,
  TemplateEmailMessage,
  SendResult,
  BulkSendResult,
  EmailProvider,
  EmailAddress,
  EmailEvents,
  EmailEventHandler,
} from './types';

/**
 * Main email service for sending emails
 * Supports multiple providers, templates, and events
 */
@Service()
@Meta({ layer: 'plugin' })
export class EmailService {
  @DI() private container!: Container;
  @Inject(EMAIL_CONFIG) private config!: EmailConfig;
  @Inject(LoggerService) private log!: LoggerService;

  private provider!: EmailProvider;
  private initialized = false;
  private eventHandlers = new Map<keyof EmailEvents, Set<EmailEventHandler<any>>>();

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  async configure(): Promise<void> {
    this.validateConfig();
    this.provider = this.createProvider();
    this.container.set(EMAIL_PROVIDER, this.provider);
  }

  async activate(): Promise<void> {
    await this.provider.initialize();
    this.initialized = true;
  }

  async onReady(): Promise<void> {
    this.log.info(`Email service ready (provider: ${this.provider.name})`);

    if (this.config.debug) {
      const verified = await this.verify();
      if (verified) {
        this.log.debug('Provider connection verified');
      } else {
        this.log.warn('Provider connection verification failed');
      }
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private validateConfig(): void {
    if (!this.config) {
      throw Err.configRequired('email', 'provider');
    }

    if (!this.config.provider) {
      throw Err.configRequired('email', 'provider configuration');
    }

    const providerType = this.config.provider.provider;

    switch (providerType) {
      case 'smtp':
        if (!this.config.provider.host) {
          throw Err.configRequired('email', 'SMTP host');
        }
        break;
      case 'resend':
        if (!this.config.provider.apiKey) {
          throw Err.configRequired('email', 'Resend API key');
        }
        break;
      case 'sendgrid':
        if (!this.config.provider.apiKey) {
          throw Err.configRequired('email', 'SendGrid API key');
        }
        break;
      case 'mailgun':
        if (!this.config.provider.apiKey || !this.config.provider.domain) {
          throw Err.configRequired('email', 'Mailgun API key and domain');
        }
        break;
      case 'ses':
        if (!this.config.provider.region) {
          throw Err.configRequired('email', 'AWS SES region');
        }
        break;
      case 'postmark':
        if (!this.config.provider.serverToken) {
          throw Err.configRequired('email', 'Postmark server token');
        }
        break;
      case 'console':
      case 'memory':
        // No required config
        break;
      default:
        throw Err.invalidOperation(`Unknown email provider: ${providerType}`);
    }
  }

  private createProvider(): EmailProvider {
    const providerConfig = this.config.provider;

    switch (providerConfig.provider) {
      case 'smtp':
        return new SmtpProvider(providerConfig);
      case 'resend':
        return new ResendProvider(providerConfig);
      case 'sendgrid':
        return new SendGridProvider(providerConfig);
      case 'console':
        return new ConsoleProvider(providerConfig);
      case 'memory':
        return new MemoryProvider(providerConfig);
      default:
        throw Err.invalidOperation(
          `Provider '${(providerConfig as any).provider}' is not implemented yet`
        );
    }
  }

  // ============================================================================
  // SENDING METHODS
  // ============================================================================

  /**
   * Send a single email
   */
  async send(message: EmailMessage): Promise<SendResult> {
    this.ensureInitialized();

    const preparedMessage = this.prepareMessage(message);

    // Emit sending event
    await this.emit('email:sending', { message: preparedMessage });

    try {
      const result = await this.executeWithRetry(() =>
        this.provider.send(preparedMessage)
      );

      if (result.success) {
        await this.emit('email:sent', { message: preparedMessage, result });
      } else {
        await this.emit('email:failed', {
          message: preparedMessage,
          error: new Error(result.error || 'Unknown error'),
        });
      }

      return result;
    } catch (error) {
      await this.emit('email:failed', {
        message: preparedMessage,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Send multiple emails in bulk
   */
  async sendBulk(messages: EmailMessage[]): Promise<BulkSendResult> {
    this.ensureInitialized();

    const preparedMessages = messages.map((m) => this.prepareMessage(m));

    if (this.provider.sendBulk) {
      return this.provider.sendBulk(preparedMessages);
    }

    // Fallback to sequential sending
    const results: SendResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const message of preparedMessages) {
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
   * Send email using a template
   */
  async sendTemplate(message: TemplateEmailMessage): Promise<SendResult> {
    const { template, variables, ...rest } = message;

    // TODO: Implement template rendering
    // For now, just throw an error
    throw Err.invalidOperation(
      'Template sending is not yet implemented. Use send() with html/text content.'
    );
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Send a simple text email
   */
  async sendText(
    to: string | EmailAddress | (string | EmailAddress)[],
    subject: string,
    text: string,
    from?: string | EmailAddress
  ): Promise<SendResult> {
    return this.send({
      to,
      subject,
      text,
      from,
    });
  }

  /**
   * Send a simple HTML email
   */
  async sendHtml(
    to: string | EmailAddress | (string | EmailAddress)[],
    subject: string,
    html: string,
    from?: string | EmailAddress
  ): Promise<SendResult> {
    return this.send({
      to,
      subject,
      html,
      from,
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Verify provider connection
   */
  async verify(): Promise<boolean> {
    this.ensureInitialized();
    if (this.provider.verify) {
      return this.provider.verify();
    }
    return true;
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string {
    return this.provider?.name || 'unknown';
  }

  /**
   * Get the underlying provider instance
   */
  getProvider<T extends EmailProvider = EmailProvider>(): T {
    return this.provider as T;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Register an event handler
   */
  on<K extends keyof EmailEvents>(
    event: K,
    handler: EmailEventHandler<K>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Remove an event handler
   */
  off<K extends keyof EmailEvents>(
    event: K,
    handler: EmailEventHandler<K>
  ): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private async emit<K extends keyof EmailEvents>(
    event: K,
    data: EmailEvents[K]
  ): Promise<void> {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (error) {
        this.log.error(`Email event handler error (${event}):`, error);
      }
    }
  }

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw Err.invalidOperation('Email service is not initialized');
    }
  }

  private prepareMessage(message: EmailMessage): EmailMessage {
    const prepared: EmailMessage = { ...message };

    // Apply default from
    if (!prepared.from && this.config.defaultFrom) {
      prepared.from = this.config.defaultFrom;
    }

    // Apply default reply-to
    if (!prepared.replyTo && this.config.defaultReplyTo) {
      prepared.replyTo = this.config.defaultReplyTo;
    }

    return prepared;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempts = this.config.retry?.attempts ?? 1,
    delay = this.config.retry?.delay ?? 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          this.log.debug(`Retry attempt ${i + 1}/${attempts} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async close(): Promise<void> {
    if (this.provider?.close) {
      await this.provider.close();
    }
    this.initialized = false;
  }
}
