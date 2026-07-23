// ============================================================================
// EmailPlugin.ts - Email Plugin Factory (Fluent API)
// ============================================================================

import { Err, plugin } from 'najm-core';
import { EMAIL_CONFIG, EMAIL_SERVICE } from './tokens';
import { EmailService } from './EmailService';
import type { EmailPluginConfig, EmailConfig, ProviderConfig } from './types';

/**
 * Load provider config from environment variables
 */
const loadProviderFromEnv = (): ProviderConfig | undefined => {
  const provider = process.env.EMAIL_PROVIDER as any;

  if (!provider) return undefined;

  switch (provider) {
    case 'resend':
      return {
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY || '',
      };
    case 'sendgrid':
      return {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY || '',
        sandboxMode: process.env.SENDGRID_SANDBOX_MODE === 'true',
      };
    case 'smtp':
      return {
        provider: 'smtp',
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      };
    case 'console':
      return {
        provider: 'console',
        logLevel: (process.env.EMAIL_LOG_LEVEL as any) || 'info',
      };
    case 'memory':
      return {
        provider: 'memory',
      };
    default:
      return undefined;
  }
};

/**
 * Default configuration values with environment variable fallbacks
 */
const DEFAULT_CONFIG: Partial<EmailConfig> = {
  provider: loadProviderFromEnv(),
  defaultFrom: process.env.EMAIL_DEFAULT_FROM,
  defaultReplyTo: process.env.EMAIL_DEFAULT_REPLY_TO,
  debug: process.env.EMAIL_DEBUG === 'true',
  retry: {
    attempts: process.env.EMAIL_RETRY_ATTEMPTS
      ? parseInt(process.env.EMAIL_RETRY_ATTEMPTS, 10)
      : 1,
    delay: process.env.EMAIL_RETRY_DELAY
      ? parseInt(process.env.EMAIL_RETRY_DELAY, 10)
      : 1000,
  },
};

/**
 * Merge user config with defaults
 */
const mergeConfig = (config?: EmailPluginConfig): EmailConfig => {
  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    retry: {
      ...DEFAULT_CONFIG.retry,
      ...config?.retry,
    },
  } as EmailConfig;

  if (!finalConfig.provider) {
    throw Err.configRequired('email', 'provider (or EMAIL_PROVIDER env var)');
  }

  return finalConfig;
};

/**
 * Email plugin using fluent builder API
 *
 * Supports configuration via:
 * 1. Direct config object (overrides env vars)
 * 2. Environment variables (as fallback)
 *
 * Environment variables:
 * - EMAIL_PROVIDER ('resend' | 'sendgrid' | 'smtp' | 'console' | 'memory')
 * - EMAIL_DEFAULT_FROM (default sender address)
 * - EMAIL_DEFAULT_REPLY_TO (default reply-to address)
 * - EMAIL_DEBUG (boolean, default: false)
 * - EMAIL_RETRY_ATTEMPTS (number, default: 1)
 * - EMAIL_RETRY_DELAY (number in ms, default: 1000)
 *
 * Provider-specific env vars:
 * - Resend: RESEND_API_KEY
 * - SendGrid: SENDGRID_API_KEY, SENDGRID_SANDBOX_MODE
 * - SMTP: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 * - Console: EMAIL_LOG_LEVEL ('info' | 'debug')
 *
 * @example
 * ```typescript
 * // Direct config (overrides env vars)
 * new Server()
 *   .use(email({
 *     provider: {
 *       provider: 'resend',
 *       apiKey: process.env.RESEND_API_KEY!,
 *     },
 *     defaultFrom: 'noreply@example.com',
 *   }))
 *   .listen(3000);
 *
 * // Using environment variables only
 * // Set: EMAIL_PROVIDER=resend, RESEND_API_KEY=re_xxx, EMAIL_DEFAULT_FROM=noreply@example.com
 * new Server()
 *   .use(email())  // Loads from env vars
 *   .listen(3000);
 *
 * // Mix: override specific values
 * new Server()
 *   .use(email({ defaultFrom: 'custom@example.com' }))  // provider from env
 *   .listen(3000);
 *
 * // SMTP with env vars
 * // Set: EMAIL_PROVIDER=smtp, SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=user, SMTP_PASS=pass
 * new Server()
 *   .use(email())
 *   .listen(3000);
 *
 * // Console provider for development
 * new Server()
 *   .use(email({
 *     provider: { provider: 'console' },
 *     defaultFrom: 'dev@localhost',
 *   }))
 *   .listen(3000);
 * ```
 */
export const email = (config?: EmailPluginConfig) =>
  plugin('email')
    .version('1.0.0')
    .services(EmailService)
    .config(EMAIL_CONFIG, mergeConfig(config))
    .set(EMAIL_SERVICE, EmailService) // Register with global token for cross-plugin access
    .build();
