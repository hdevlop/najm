# Changelog

## 3.1.0 - 2026-10-10

- Added `emailConfigFromEnv(env, { defaultProvider?, defaultFrom? })`, which
  builds validated config from the standard variables passed as literal
  `process.env` reads: required credentials, SMTP user and password together,
  port 1–65535 and retry settings, each failure naming its variable. Without
  `defaultProvider`, `EMAIL_PROVIDER` is required. A configured
  `EMAIL_DEFAULT_FROM` wins over `defaultFrom`.
- Importing najm-email no longer reads the environment. The env fallbacks of
  `email()` are read when it is called; direct config still takes precedence.
- Failed deliveries are logged through `LoggerService` by default: once per
  `send()` after retries, and once per `sendBulk()` with the failed count on
  every path (a provider batch, the inherited `BaseProvider.sendBulk`, the
  sequential fallback, or a thrown batch). The entry holds only the provider
  name, the operation and the count — never recipients, subjects, content,
  provider responses or error text. `logFailures: false` turns it off. Results,
  rejections and `email:*` events are unchanged.
- Requires najm-core 3.1.0 (`najm-core/env`).

## 3.0.0 - 2026-10-04

- Breaking: require Nodemailer ^10.0.14 and use its native transport/message types.
- Verify SMTP envelope, message body, and attachments against a loopback transport fixture.
