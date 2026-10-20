# Changelog

## 3.3.0 - 2026-10-21

- `accountInviteTemplate` accepts a `theme` (`AccountInviteEmailTheme`, also
  exported): page, header, button, panel and note colors, a `logoBackground`
  plate and a `logoHeight` of 16 to 200 pixels. A logo drawn for a light
  background disappeared into the dark green header; the plate keeps it
  readable and the height lets it be large enough to read.
- A color left out keeps its default, so a call without a theme renders byte for
  byte as before. A value that is not a color (a hex value, `rgb()`/`rgba()` or
  a color name) is ignored instead of being written into the markup's styles.

## 3.2.0 - 2026-10-17

- `passwordResetTemplate` and `accountInviteTemplate` accept `lang` and a
  `copy` object (`PasswordResetEmailCopy`, `AccountInviteEmailCopy`) of
  plain-text fields, already interpolated by the caller and escaped by the
  template. A missing or empty field keeps the English default, so existing
  calls render as before. These security emails were English only.
- `lang` sets the document's `lang` and `dir`; `emailTextDirection` (also
  exported) treats Arabic, Persian, Hebrew and Urdu as right to left.
- The password reset email escapes its expiry text, as the invitation
  already did.

## 3.1.1 - 2026-10-10

- Resend attachments carry `content_disposition` and `content_id` from the
  message's `disposition` and `cid`, as the SMTP and SendGrid providers
  already did. An inline image referenced as `cid:` in the HTML — such as the
  logo najm-auth embeds in account invitations — now renders through Resend
  instead of arriving as a plain attachment.

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
