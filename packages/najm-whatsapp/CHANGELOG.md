# Changelog

## 3.0.0 - 2026-10-04

- Breaking: adopt Auth 6, Rate 3, and Kit 3; omitted proxy trust uses the socket peer.
- Isolate instance factories and Baileys loader mocks per test to prevent cross-file contamination.
- Require Hono ^4.13.12.
