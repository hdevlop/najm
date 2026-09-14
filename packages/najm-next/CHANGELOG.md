# Changelog

## Unreleased

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
