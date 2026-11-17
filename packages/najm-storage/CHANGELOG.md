# Changelog

## 4.1.0 - 2026-11-17

- `validator`: a `StorageValidator` subclass that replaces it wherever it is
  injected, for application upload rules such as per-namespace categories.
- A second `storage()` (another server, a test) replaces the guards the
  previous call put on the shared storage controllers instead of adding to them.

## 4.0.1 - 2026-11-16

- The studio keeps its emerald accent: `dark` is set on the theme provider
  element. A nested `.dark` wrapper re-declared every token and turned
  `text-primary` icons near-black.
- The studio mounts after hydration, so Next hosts no longer report
  "Hydration failed" for its client router.

## 4.0.0 - 2026-10-04

- Breaking: require Najm Kit 3 for the studio dependency; backend and storage APIs are unchanged.
- Require Hono ^4.13.12 and Sharp ^0.35.5.
