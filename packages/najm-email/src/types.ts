// ============================================================================
// types.ts - Email Plugin Type Definitions
// ============================================================================

/**
 * Email address with optional name
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Filename to display */
  filename: string;
  /** Content as Buffer, string, or base64 */
  content: Buffer | string;
  /** MIME type (e.g., 'application/pdf') */
  contentType?: string;
  /** Content-ID for inline images */
  cid?: string;
  /** Content disposition (default: 'attachment') */
  disposition?: 'attachment' | 'inline';
  /** Encoding (default: 'base64') */
  encoding?: 'base64' | 'binary' | 'utf8';
}

/**
 * Email message structure
 */
export interface EmailMessage {
  /** Recipient(s) */
  to: string | EmailAddress | (string | EmailAddress)[];
  /** Sender */
  from?: string | EmailAddress;
  /** CC recipients */
  cc?: string | EmailAddress | (string | EmailAddress)[];
  /** BCC recipients */
  bcc?: string | EmailAddress | (string | EmailAddress)[];
  /** Reply-to address */
  replyTo?: string | EmailAddress;
  /** Email subject */
  subject: string;
  /** Plain text content */
  text?: string;
  /** HTML content */
  html?: string;
  /** File attachments */
  attachments?: EmailAttachment[];
  /** Custom headers */
  headers?: Record<string, string>;
  /** Priority (1 = high, 3 = normal, 5 = low) */
  priority?: 1 | 3 | 5;
  /** Message tags for tracking */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Template variables for email templates
 */
export type TemplateVariables = Record<string, any>;

/**
 * Email template message
 */
export interface TemplateEmailMessage extends Omit<EmailMessage, 'text' | 'html'> {
  /** Template name/ID */
  template: string;
  /** Template variables */
  variables?: TemplateVariables;
}

/**
 * Result of sending an email
 */
export interface SendResult {
  /** Whether the email was sent successfully */
  success: boolean;
  /** Message ID from provider */
  messageId?: string;
  /** Provider-specific response data */
  response?: any;
  /** Error message if failed */
  error?: string;
}

/**
 * Bulk send result
 */
export interface BulkSendResult {
  /** Total emails attempted */
  total: number;
  /** Successfully sent count */
  sent: number;
  /** Failed count */
  failed: number;
  /** Individual results */
  results: SendResult[];
}

// ============================================================================
// Provider Types
// ============================================================================

/**
 * SMTP configuration
 */
export interface SmtpConfig {
  provider: 'smtp';
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
    minVersion?: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

/**
 * Resend configuration
 */
export interface ResendConfig {
  provider: 'resend';
  apiKey: string;
  baseUrl?: string;
}

/**
 * SendGrid configuration
 */
export interface SendGridConfig {
  provider: 'sendgrid';
  apiKey: string;
  sandboxMode?: boolean;
}

/**
 * Mailgun configuration
 */
export interface MailgunConfig {
  provider: 'mailgun';
  apiKey: string;
  domain: string;
  region?: 'us' | 'eu';
}

/**
 * AWS SES configuration
 */
export interface SesConfig {
  provider: 'ses';
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Postmark configuration
 */
export interface PostmarkConfig {
  provider: 'postmark';
  serverToken: string;
}

/**
 * Console provider (for development/testing)
 */
export interface ConsoleConfig {
  provider: 'console';
  /** Log level */
  logLevel?: 'info' | 'debug';
}

/**
 * Memory provider (for testing)
 */
export interface MemoryConfig {
  provider: 'memory';
}

/**
 * Union type for all provider configs
 */
export type ProviderConfig =
  | SmtpConfig
  | ResendConfig
  | SendGridConfig
  | MailgunConfig
  | SesConfig
  | PostmarkConfig
  | ConsoleConfig
  | MemoryConfig;

// ============================================================================
// Plugin Configuration
// ============================================================================

/**
 * Email template configuration
 */
export interface TemplateConfig {
  /** Template directory path */
  dir?: string;
  /** Template engine ('handlebars' | 'ejs' | 'pug') */
  engine?: 'handlebars' | 'ejs' | 'pug';
  /** Default template extension */
  extension?: string;
  /** Enable template caching */
  cache?: boolean;
}

/**
 * Complete email plugin configuration
 */
export interface EmailConfig {
  /** Provider configuration */
  provider: ProviderConfig;
  /** Default sender address */
  defaultFrom?: string | EmailAddress;
  /** Default reply-to address */
  defaultReplyTo?: string | EmailAddress;
  /** Template configuration */
  templates?: TemplateConfig;
  /** Enable debug logging */
  debug?: boolean;
  /** Retry configuration */
  retry?: {
    /** Number of retry attempts */
    attempts?: number;
    /** Delay between retries in ms */
    delay?: number;
  };
  /** Queue configuration (future use) */
  queue?: {
    enabled?: boolean;
    concurrency?: number;
  };
}

/**
 * Partial configuration for email plugin
 */
export type EmailPluginConfig = EmailConfig;

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Email provider interface that all providers must implement
 */
export interface EmailProvider {
  /** Provider name */
  readonly name: string;

  /** Initialize the provider */
  initialize(): Promise<void>;

  /** Send a single email */
  send(message: EmailMessage): Promise<SendResult>;

  /** Send multiple emails (bulk) */
  sendBulk?(messages: EmailMessage[]): Promise<BulkSendResult>;

  /** Verify provider connection/credentials */
  verify?(): Promise<boolean>;

  /** Close/cleanup provider resources */
  close?(): Promise<void>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Email event types for hooks/events
 */
export interface EmailEvents {
  'email:sending': { message: EmailMessage };
  'email:sent': { message: EmailMessage; result: SendResult };
  'email:failed': { message: EmailMessage; error: Error };
}

/**
 * Email event handler type
 */
export type EmailEventHandler<K extends keyof EmailEvents> = (
  event: EmailEvents[K]
) => void | Promise<void>;
