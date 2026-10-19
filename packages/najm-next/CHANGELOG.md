# Changelog

## 0.13.0 - 2026-10-19

- Add opt-in staged public-shell updates with complete-manifest readiness,
  temporary download caches, immutable asset validation, explicit all-window
  activation consent, retained old assets and no forced document reload.
- Add the browser/worker-safe `najm-next/pwa/client` lifecycle helper. Default
  consumers keep immediate activation and cleanup. Data schema migration and
  automatic old-build reclamation remain application concerns.
- Prove failed downloads, evicted assets, dirty/unresponsive tabs, old lazy
  assets and preserved IndexedDB pending work in three desktop engines.

## 0.12.0 - 2026-10-19

- Add opt-in `navigationFallback` to `najm-next/pwa`: explicit document paths,
  a default 10-second response-header deadline, and cached public-shell
  fallback on rejection or gateway 502/503/504. Preserve domain errors,
  redirects, downloads and API/RSC payloads. An unavailable shell retains the
  network response; default consumers keep their previous behavior.
- Add executable worker tests and a real Chromium/Firefox/WebKit fixture for
  fallback, late responses, route isolation and redirect preservation.
  Worker update lifecycle, offline authorization and storage remain separate.

## 0.11.0 - 2026-10-19

- Publish the validated `0.11.0-offline.0` provider integration as a regular
  release through npm's default channel. The existing stable Kit peer range
  accepts `najm-kit@3.7.0`; remove the prerelease-only peer alternative.

## 0.11.0-offline.0 - 2026-10-19

- Support Kit's `uiRuntime` option through the existing `NajmAppProvider`
  prop forwarding and accept `najm-kit@3.7.0-offline.0` as a peer. The provider
  keeps one auth client and QueryClient when runtime callbacks change.
- Add a built-entry browser fixture proving router-independent mounting,
  local preference persistence while disconnected, and draft preservation in
  Chromium, Firefox and WebKit. This does not implement offline authorization,
  asset updates, data downloads or synchronization.

## 0.10.0 - 2026-10-10

- Added `najm-next/env` with `isNextBuildPhase()`, true only while
  `next build` evaluates server modules. The entry has no imports, so server
  packages and seed scripts can use it without loading Next or React.

## 0.9.0 - 2026-10-04

- Require patched Next ^15.5.24 || ^16.3.6 and reject older versions during configuration.
- Accept Auth 6, Kit 3, and Theme 0.3 while retaining supported prior Najm peer ranges.

## 0.8.0 - 2026-09-17

- Added validated `appName` and `currency` application defaults and projects
  only those display values into the public server snapshot.
- The direct full `NajmAppProvider` now mounts one Query client by default;
  custom integrations remain supported while boolean activation is rejected.
- Preserved legacy snapshots, the deprecated factory compatibility path, and
  the dependency-neutral lower-level composer for applications without Query.

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
