// ============================================================================
// emailConfigFromEnv.ts - Validated email config from environment variables
// ============================================================================

import { envChoice, envFlag, envInt, envString, requireEnv } from 'najm-core/env';
import type { EmailPluginConfig, ProviderConfig } from './types';

/** Providers `emailConfigFromEnv` can configure from environment variables. */
export const EMAIL_ENV_PROVIDERS = ['console', 'memory', 'resend', 'sendgrid', 'smtp'] as const;
export type EmailEnvProvider = (typeof EMAIL_ENV_PROVIDERS)[number];

/**
 * The variables `emailConfigFromEnv` reads. Pass each as a literal
 * `process.env.NAME` read, so every variable stays visible to the bundler and
 * to a search; the helper never looks a name up itself.
 */
export interface EmailEnv {
  /** console | memory | resend | sendgrid | smtp */
  EMAIL_PROVIDER?: string;
  /** console: debug | info (default info) */
  EMAIL_LOG_LEVEL?: string;
  /** resend */
  RESEND_API_KEY?: string;
  /** sendgrid */
  SENDGRID_API_KEY?: string;
  /** sendgrid: 1 | true accepts mail without sending it */
  SENDGRID_SANDBOX_MODE?: string;
  /** smtp */
  SMTP_HOST?: string;
  /** smtp: 1-65535 (default 587) */
  SMTP_PORT?: string;
  /** smtp: both or neither of SMTP_USER and SMTP_PASS */
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** smtp: 1 | true for implicit TLS */
  SMTP_SECURE?: string;
  EMAIL_DEFAULT_FROM?: string;
  EMAIL_DEFAULT_REPLY_TO?: string;
  /** 1 | true */
  EMAIL_DEBUG?: string;
  /** 1 or more (default 1) */
  EMAIL_RETRY_ATTEMPTS?: string;
  /** milliseconds (default 1000) */
  EMAIL_RETRY_DELAY?: string;
}

export interface EmailConfigFromEnvOptions {
  /** Provider used when EMAIL_PROVIDER is unset or blank. Without it, EMAIL_PROVIDER is required. */
  defaultProvider?: EmailEnvProvider;
  /** Sender used when EMAIL_DEFAULT_FROM is unset or blank. A configured EMAIL_DEFAULT_FROM always wins. */
  defaultFrom?: string;
}

const FOR_PROVIDER = 'for the configured email provider';

/**
 * Build `email()` config from environment variables, validating them now: a
 * missing credential, a half-configured SMTP login or a malformed number
 * throws an error naming the variable instead of reaching a provider.
 *
 * The values are read when this is called, not when najm-email is imported.
 *
 * @example
 * ```ts
 * email(emailConfigFromEnv({
 *   EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
 *   RESEND_API_KEY: process.env.RESEND_API_KEY,
 *   EMAIL_DEFAULT_FROM: process.env.EMAIL_DEFAULT_FROM,
 * }, { defaultProvider: 'console' }))
 * ```
 */
export function emailConfigFromEnv(env: EmailEnv, options: EmailConfigFromEnvOptions = {}): EmailPluginConfig {
  return {
    provider: providerFromEnv(env, options.defaultProvider),
    defaultFrom: envString(env.EMAIL_DEFAULT_FROM) ?? options.defaultFrom,
    defaultReplyTo: envString(env.EMAIL_DEFAULT_REPLY_TO),
    debug: envFlag(env.EMAIL_DEBUG),
    retry: {
      attempts: envInt('EMAIL_RETRY_ATTEMPTS', env.EMAIL_RETRY_ATTEMPTS, { fallback: 1, min: 1 }),
      delay: envInt('EMAIL_RETRY_DELAY', env.EMAIL_RETRY_DELAY, { fallback: 1_000 }),
    },
  };
}

function providerFromEnv(env: EmailEnv, defaultProvider: EmailEnvProvider | undefined): ProviderConfig {
  const provider = defaultProvider
    ? envChoice('EMAIL_PROVIDER', env.EMAIL_PROVIDER, EMAIL_ENV_PROVIDERS, defaultProvider)
    : envChoice(
      'EMAIL_PROVIDER',
      requireEnv('EMAIL_PROVIDER', env.EMAIL_PROVIDER, `(one of: ${EMAIL_ENV_PROVIDERS.join(', ')})`),
      EMAIL_ENV_PROVIDERS,
      EMAIL_ENV_PROVIDERS[0],
    );

  switch (provider) {
    case 'console':
      return {
        provider,
        logLevel: envString(env.EMAIL_LOG_LEVEL)?.toLowerCase() === 'debug' ? 'debug' : 'info',
      };
    case 'memory':
      return { provider };
    case 'resend':
      return {
        provider,
        apiKey: requireEnv('RESEND_API_KEY', env.RESEND_API_KEY, FOR_PROVIDER),
      };
    case 'sendgrid':
      return {
        provider,
        apiKey: requireEnv('SENDGRID_API_KEY', env.SENDGRID_API_KEY, FOR_PROVIDER),
        sandboxMode: envFlag(env.SENDGRID_SANDBOX_MODE),
      };
    case 'smtp': {
      const user = envString(env.SMTP_USER);
      const pass = envString(env.SMTP_PASS);
      if (Boolean(user) !== Boolean(pass)) {
        throw new Error('SMTP_USER and SMTP_PASS must be configured together.');
      }
      return {
        provider,
        host: requireEnv('SMTP_HOST', env.SMTP_HOST, FOR_PROVIDER),
        port: envInt('SMTP_PORT', env.SMTP_PORT, { fallback: 587, min: 1, max: 65_535 }),
        secure: envFlag(env.SMTP_SECURE),
        auth: user && pass ? { user, pass } : undefined,
      };
    }
  }
}
