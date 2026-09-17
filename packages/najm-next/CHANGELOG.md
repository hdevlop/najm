# Changelog

## 0.7.0 - 2026-09-17

- Added `location: true` and serializable custom location policy to the app
  definition, including the shared Leaflet preset and deterministic env prefix.
- Next server snapshots and CSP proxy composition now resolve app-declared
  location automatically; the legacy explicit location hooks remain supported.
- The direct `NajmAppProvider` consumes snapshot location automatically and
  makes Query an explicit opt-in. The deprecated factory retains its prior
  Query default during the compatibility window.
- Added shared lazy Google geocoding, reactive locale labels, and updated CLI
  scaffolding without per-app location provider or proxy selectors.

## 0.6.0 - 2026-09-15

- Added the direct `NajmAppProvider` API with Auth, Query, extension, Kit UI,
  Theme branding, and typed location integration props. The compatibility
  factory now delegates to the same generic composition engine.
- Provider bindings keep stable component identity across normal rerenders,
  Query clients remain isolated per mount, and unsupported Auth/Query identity
  changes fail clearly instead of mixing old clients with new providers.
- Added `najm-next/app/client` with `createNajmAppProvider`, giving full Najm
  applications one provider that accepts the complete server snapshot and Kit
  UI props while owning Auth, Query, branding, and optional location wiring.
- Added the optional `najm-next/query/tanstack` adapter with balanced query
  defaults, partial application overrides, server-error retry policy, and one
  stable `QueryClient` per mounted application.
- Added the high-level `query` integration prop to `NajmNextAppProvider` while
  retaining the low-level query client and provider-binding API for migration.
- Added `najm-next/app/next`, which binds Next request readers, Najm Auth's
  request-scoped session adapter, Theme bootstrap, and Kit preference
  resolution in one module-scope factory.
- Allow the Next adapter to add typed, derived preference fields through
  `mapPreferences` after stored preference values are normalized.
- Preserve concrete session types through `createNajmServerApp` and narrow
  location results from each application's allowed provider list.

## 0.5.0 - 2026-09-13

- Added pure app configuration plus request-scoped server bootstrap and
  client-provider composition entrypoints.
- Added typed Google location runtime projection and validated CSP
  contributions while preserving disabled and Leaflet configurations.
- Added production Next fixtures for Kafil-style and School-style integration,
  including the emitted `"use client"` package boundary.

## 0.4.0 - 2026-09-12

- Added provider-neutral Leaflet location runtime configuration.
