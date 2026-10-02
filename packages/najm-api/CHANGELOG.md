# Changelog

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
