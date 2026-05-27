// ============================================================================
// Email Plugin Exports
// ============================================================================

// Plugin factory function
export { email } from './EmailPlugin';

// Main service
export { EmailService } from './EmailService';

// Configuration tokens
export { EMAIL_CONFIG, EMAIL_PROVIDER, EMAIL_SERVICE } from './tokens';

// Types
export type {
  // Core types
  EmailAddress,
  EmailAttachment,
  EmailMessage,
  TemplateEmailMessage,
  TemplateVariables,
  SendResult,
  BulkSendResult,
  // Provider types
  EmailProvider,
  SmtpConfig,
  ResendConfig,
  SendGridConfig,
  MailgunConfig,
  SesConfig,
  PostmarkConfig,
  ConsoleConfig,
  MemoryConfig,
  ProviderConfig,
  // Config types
  TemplateConfig,
  EmailConfig,
  EmailPluginConfig,
  // Event types
  EmailEvents,
  EmailEventHandler,
} from './types';

// Providers (for advanced usage or custom providers)
export {
  BaseProvider,
  SmtpProvider,
  ResendProvider,
  SendGridProvider,
  ConsoleProvider,
  MemoryProvider,
} from './providers';

// Email Templates
export {
  escapeHtml,
  passwordResetTemplate,
  welcomeEmailTemplate,
  emailVerificationTemplate,
} from './templates';
