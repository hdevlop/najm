# AGENTS.md - najm-kit

## Scope

- This package is the React UI component library for Najm apps, not a Najm backend plugin.
- Public surfaces are `src/index.ts`, `src/adapters/next.tsx`, `src/json/index.ts`, and `src/theme.css`; keep these aligned with `package.json` `exports`.
- Tailwind v4 only. `src/theme.css` is a Tailwind v4 *source* file (not precompiled CSS): it carries `@source "./"`, `@custom-variant dark`, the `@theme inline` token map, the default oklch `--*` tokens (standard shadcn names, no prefix), and component utilities. Consumers compile it with their own v4 build via `@import "tailwindcss"; @import "najm-kit/theme.css";`.
- Use package-local patterns before adding new primitives: Radix-based UI in `src/components/ui`, higher-level `N*` components in feature folders, shared helpers in `src/lib`, theme tokens in `src/theme`.

## Commands

- Build from repo root: `bun run build:ui`; package-local equivalent is `bun run --cwd packages/najm-kit build`.
- Build CSS only: `bun run --cwd packages/najm-kit build:css`.
- Run tests: `bun run test:ui` or `bun test packages/najm-kit`.
- Run one file: `bun run --cwd packages/najm-kit test test/<file>.test.tsx`.
- Type-check source only (build tsconfig): `bun run --cwd packages/najm-kit typecheck`.
- Type-check source + tests: `bun run --cwd packages/najm-kit typecheck:tests` (uses `tsconfig.test.json`; pulls `bun` types for `@testing-library` test globals).
- Lint (alias for both type checks): `bun run --cwd packages/najm-kit lint`; from repo root: `bun run lint:ui`.
- Run the Vite playground: `bun run --cwd packages/najm-kit dev`; it uses `playground` as Vite root and serves on `127.0.0.1:5177`.
- Build the playground only when needed: `bun run --cwd packages/najm-kit build:preview`.

## Build Quirks

- `build` runs `tsup` then `node scripts/build-css.mjs`; do not call `tsup` alone when verifying published output.
- `tsup.config.ts` emits ESM `.mjs` entries for `index`, `adapters/next`, and `json`, and treats React, Next, lucide, phone input, and CodeMirror packages as externals.
- `scripts/build-css.mjs` does NOT compile Tailwind (the consumer's v4 build does). It assembles `src/theme.css` into `dist/theme.css`, writes `dist/theme.css.d.ts`, and appends OverlayScrollbars + `react-international-phone` CSS so the import is self-contained. The authored `@import "tw-animate-css"` must stay the first statement, so all inlined third-party CSS is appended after it.
- If Tailwind class names are generated dynamically (e.g. `borders.ts`, `BaseInput.tsx`), add them to the `@source inline(...)` lines in `src/theme.css` or the consumer's build will not emit them.

## Tests

- `bunfig.toml` preloads `test/setup.ts`; it installs happy-dom globals and Testing Library cleanup. Prefer package/root test commands that preserve this preload.
- DOM component tests use `@testing-library/react`; add focused tests beside the existing component area (`test/table`, `test/slider`, `test/tabs`, etc.).
- Keep barrel/export tests passing when adding or renaming public components.

## UI Conventions

- Preserve browser/server separation: Next-only code belongs in `src/adapters/next.tsx`; avoid importing Next APIs from the main `najm-kit` entry.
- Keep optional-heavy editor code behind `najm-kit/json`; do not pull CodeMirror into `src/index.ts` consumers unless the export contract intentionally changes.
- Components should work with host Tailwind v4 plus `najm-kit/theme.css`; changes to tokens or global styles must be verified through the package build, not only the Vite playground.
- The playground aliases `najm-kit` and `najm-kit/theme.css` to `src`, so it is useful for local UI checks but does not prove `dist` exports are correct.
