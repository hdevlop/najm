# WA Studio UI Plan

## Purpose

The WhatsApp studio is an embedded surface that lives inside a consuming app.
UI-level changes go through this plan rather than direct edits so the design
stays cohesive across the studio.

## Migrations

### 2026-06-14 — v4 + shadcn-token contract migration (per `NAJM_KIT_V4_SHADCN_MIGRATION_PLAN.md`)

- Remove v3 Tailwind config (`tailwind.config.ts` deleted), `@tailwindcss/postcss@^4` + `tailwindcss@^4` in devDeps, no `tailwindcss-animate` / `autoprefixer`.
- Move the v3 custom theme into `@theme` blocks inside `src/studio/styles/index.css`; keep `postcss-prefix-selector` (still needed to scope the studio).
- New `src/studio/styles/index.css`:
  - `@import "tailwindcss/theme.css" layer(theme)` + `@import "tailwindcss/utilities.css" layer(utilities)` (no preflight) + `@import "najm-kit/theme.css"`.
  - `wa-studio` `boxShadow` (`brand-glow`, `card`), `fontFamily.mono` and `status` colors ported into `@theme` as `--shadow-*` / `--font-*` / `--color-status-*`.
  - Old `--primary` / `--najm-primary` / `--wa-brand` triplet blocks deleted (theme is driven by the `<NajmThemeProvider mode="dark" accent="green">` prop in `studio.tsx`).
- `scripts/build-css.mjs` rewritten to use `@tailwindcss/postcss` + an extended `prefixPlugin` that also rewrites `:root` → `.wa-studio` and `.dark` → `.wa-studio.dark, .wa-studio .dark`, so the imported najm-kit `theme.css` doesn't leak global token blocks into the host page.
- `src/studio/app/studio.tsx` deletes the legacy kit styles import — the kit's styles now come through the compiled studio CSS via `@import "najm-kit/theme.css"` inside the source stylesheet.

## Future UI changes

Add a new section here for any further studio UI work.
