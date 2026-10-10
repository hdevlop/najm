import { afterEach, describe, expect, test } from 'bun:test';
import { email, emailConfigFromEnv } from '../src';

describe('emailConfigFromEnv', () => {
  test('defaults to the given provider and sender when the variables are unset or blank', () => {
    const config = emailConfigFromEnv(
      { EMAIL_PROVIDER: ' ', EMAIL_DEFAULT_FROM: '' },
      { defaultProvider: 'console', defaultFrom: 'noreply@app.local' },
    );

    expect(config.provider).toEqual({ provider: 'console', logLevel: 'info' });
    expect(config.defaultFrom).toBe('noreply@app.local');
    expect(config.defaultReplyTo).toBeUndefined();
    expect(config.debug).toBe(false);
    expect(config.retry).toEqual({ attempts: 1, delay: 1_000 });
  });

  test('a configured sender wins over the fallback; without a fallback the sender stays unset', () => {
    expect(emailConfigFromEnv(
      { EMAIL_DEFAULT_FROM: ' school@example.org ' },
      { defaultProvider: 'console', defaultFrom: 'noreply@app.local' },
    ).defaultFrom).toBe('school@example.org');

    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'memory' }).defaultFrom).toBeUndefined();
  });

  test('without a default provider, EMAIL_PROVIDER is required', () => {
    expect(() => emailConfigFromEnv({})).toThrow('EMAIL_PROVIDER is required');
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'MEMORY' }).provider).toEqual({ provider: 'memory' });
  });

  test('an unknown provider names the choices', () => {
    expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'mailgun' }, { defaultProvider: 'console' }))
      .toThrow("EMAIL_PROVIDER must be one of: console, memory, resend, sendgrid, smtp. Got 'mailgun'.");
  });

  test('console log level', () => {
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'console', EMAIL_LOG_LEVEL: 'debug' }).provider)
      .toEqual({ provider: 'console', logLevel: 'debug' });
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'console', EMAIL_LOG_LEVEL: 'verbose' }).provider)
      .toEqual({ provider: 'console', logLevel: 'info' });
  });

  test('each provider requires its credentials', () => {
    expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'resend' }))
      .toThrow('RESEND_API_KEY is required for the configured email provider.');
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: ' re_1 ' }).provider)
      .toEqual({ provider: 'resend', apiKey: 're_1' });

    expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: '' }))
      .toThrow('SENDGRID_API_KEY is required for the configured email provider.');
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'sendgrid', SENDGRID_API_KEY: 'sg', SENDGRID_SANDBOX_MODE: '1' }).provider)
      .toEqual({ provider: 'sendgrid', apiKey: 'sg', sandboxMode: true });

    expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'smtp' }))
      .toThrow('SMTP_HOST is required for the configured email provider.');
  });

  test('SMTP: user and password together, port bounds, secure flag', () => {
    expect(emailConfigFromEnv({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'mail.local' }).provider).toEqual({
      provider: 'smtp', host: 'mail.local', port: 587, secure: false, auth: undefined,
    });
    expect(emailConfigFromEnv({
      EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'mail.local', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p',
    }).provider).toEqual({ provider: 'smtp', host: 'mail.local', port: 465, secure: true, auth: { user: 'u', pass: 'p' } });

    for (const half of [{ SMTP_USER: 'u' }, { SMTP_PASS: 'p' }, { SMTP_USER: 'u', SMTP_PASS: ' ' }]) {
      expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', ...half }))
        .toThrow('SMTP_USER and SMTP_PASS must be configured together.');
    }
    for (const port of ['abc', '0', '65536', '25.5']) {
      expect(() => emailConfigFromEnv({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'h', SMTP_PORT: port }))
        .toThrow('SMTP_PORT must be an integer from 1 to 65535.');
    }
  });

  test('retry settings are validated', () => {
    const base = { EMAIL_PROVIDER: 'memory' };
    expect(emailConfigFromEnv({ ...base, EMAIL_RETRY_ATTEMPTS: '3', EMAIL_RETRY_DELAY: '0' }).retry)
      .toEqual({ attempts: 3, delay: 0 });
    expect(() => emailConfigFromEnv({ ...base, EMAIL_RETRY_ATTEMPTS: 'abc' }))
      .toThrow('EMAIL_RETRY_ATTEMPTS must be an integer 1 or more.');
    expect(() => emailConfigFromEnv({ ...base, EMAIL_RETRY_ATTEMPTS: '0' }))
      .toThrow('EMAIL_RETRY_ATTEMPTS must be an integer 1 or more.');
    expect(() => emailConfigFromEnv({ ...base, EMAIL_RETRY_DELAY: '-5' }))
      .toThrow('EMAIL_RETRY_DELAY must be an integer 0 or more.');
  });

  test('reply-to and debug', () => {
    const config = emailConfigFromEnv({ EMAIL_PROVIDER: 'memory', EMAIL_DEFAULT_REPLY_TO: ' help@x.org ', EMAIL_DEBUG: 'TRUE' });
    expect(config.defaultReplyTo).toBe('help@x.org');
    expect(config.debug).toBe(true);
  });
});

describe('env fallback in email()', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  });

  const configOf = (plugin: { config?: unknown }) => plugin.config as Record<string, any>;

  test('reads the environment when email() is called, not at import', () => {
    process.env.EMAIL_PROVIDER = 'memory';
    process.env.EMAIL_DEFAULT_FROM = 'late@example.org';

    const config = configOf(email());
    expect(config.provider).toEqual({ provider: 'memory' });
    expect(config.defaultFrom).toBe('late@example.org');
  });

  test('direct config keeps precedence over environment defaults', () => {
    process.env.EMAIL_PROVIDER = 'memory';
    process.env.EMAIL_DEFAULT_FROM = 'env@example.org';
    process.env.EMAIL_RETRY_ATTEMPTS = '4';

    const config = configOf(email({ provider: { provider: 'console' }, defaultFrom: 'direct@example.org', retry: { delay: 5 } }));
    expect(config.provider).toEqual({ provider: 'console' });
    expect(config.defaultFrom).toBe('direct@example.org');
    expect(config.retry).toEqual({ attempts: 4, delay: 5 });
  });

  test('importing the package with no email environment does not throw', async () => {
    for (const key of Object.keys(process.env)) if (key.startsWith('EMAIL_') || key.startsWith('SMTP_')) delete process.env[key];
    const module = await import(`../src/index.ts?fresh=${Date.now()}`);
    expect(typeof module.email).toBe('function');
    expect(() => module.email()).toThrow();
  });
});
