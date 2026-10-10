# Changelog

## 2.2.0 - 2026-10-10

- Added the opt-in `server: { languageHeader }` option for a server whose own
  client names its interface language in a header. It changes the detection
  defaults to `order: ['header', 'cookie', 'querystring']`,
  `lookupFromHeaderKey: languageHeader` and `caches: []`; explicit options
  still win. A page then receives messages in the language it shows even when
  a `language` cookie disagrees, and detection never writes a cookie that
  would pin later requests. Without the option nothing changes.
- `getConfig()` reports the effective detection settings, and
  `resolveDetectionDefaults()` is exported.

## 2.1.3 - 2026-10-04

- Require patched Hono ^4.13.12 and compatible Najm core dependencies.
