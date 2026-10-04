# Changelog

## 5.0.0 - 2026-10-04

- Breaking: aggregate Auth 6, Rate 3, Email 3, and Storage 4 with the production security fixes.
- Configure trustedProxyHops explicitly behind a controlled reverse proxy; SMTP uses Nodemailer 10.

## 3.1.1 - 2026-10-03

- Adopt najm-database 2.1.1, restoring `close: false` as the default.
  Existing `database(db)` configurations preserve caller ownership;
  use `database({ default: db, close: true })` to enable automatic cleanup.

## 3.1.0 - 2026-10-03

- Export `DatabasePluginOptions` from the root entry.
- Adopt najm-database 2.1.0 and najm-auth 4.2.4. `database(db)` now closes
  supported clients on stop; shared pools must use
  `database({ default: db, close: false })`. Auth seeding retains caller
  ownership of its database.

## 2.1.0 - 2026-09-28

- Export `Owned` and the `OwnedWhere` type from the root entry, alongside the
  existing ownership policy helpers. The `najm-api/auth` subpath continues to
  re-export the complete `najm-auth` API.
