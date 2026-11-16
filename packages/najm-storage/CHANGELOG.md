# Changelog

## 4.0.1 - 2026-11-16

- The studio keeps its emerald accent: `dark` is set on the theme provider
  element. A nested `.dark` wrapper re-declared every token and turned
  `text-primary` icons near-black.
- The studio mounts after hydration, so Next hosts no longer report
  "Hydration failed" for its client router.

## 4.0.0 - 2026-10-04

- Breaking: require Najm Kit 3 for the studio dependency; backend and storage APIs are unchanged.
- Require Hono ^4.13.12 and Sharp ^0.35.5.
