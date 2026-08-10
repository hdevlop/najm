// ============================================================================
// Playground — the factory theme
// ============================================================================
//
// One directory, and this is all of it: `theme.json` next door holds the design
// this deployment ships with, and the four fixed image names hold the marks.
// `defineTheme` reads and validates them relative to *this file*, so the same
// definition resolves from `bun run playground`, from a test, from the Next
// server bundle, and from a container — none of which share a working
// directory.
//
// The mix of formats is deliberate. `sidebar-logo-collapsed` and `auth-logo`
// are WebP, the other two are PNG, so one visual pass through the running
// product proves both formats are served with the right content type.
//
// Nothing else about branding lives in this application. No asset paths, no
// slot names, no route prefixes, no fallback map, no factory callbacks.
// ============================================================================

import { defineTheme } from 'najm-theme/theme';

export const appTheme = defineTheme(import.meta.url);
