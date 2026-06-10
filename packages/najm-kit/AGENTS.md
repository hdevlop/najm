# AGENTS.md - najm-kit

## Scope

- This package is the React UI component library for Najm apps, not a Najm backend plugin.
- Public surfaces are `src/index.ts`, `src/adapters/next.tsx`, `src/json/index.ts`, and `src/styles.css`; keep these aligned with `package.json` `exports`.
- Use package-local patterns before adding new primitives: Radix-based UI in `src/components/ui`, higher-level `N*` components in feature folders, shared helpers in `src/lib`, theme tokens in `src/theme`.

## Commands

- Build from repo root: `bun run build:ui`; package-local equivalent is `bun run --cwd packages/najm-kit build`.
- Build CSS only: `bun run --cwd packages/najm-kit build:css`.
- Run tests: `bun run test:ui` or `bun test packages/najm-kit`.
- Run one file: `bun test packages/najm-kit/test/<file>.test.tsx`.
- Run the Vite playground: `bun run --cwd packages/najm-kit dev`; it uses `playground` as Vite root and serves on `127.0.0.1:5177`.
- Build the playground only when needed: `bun run --cwd packages/najm-kit build:preview`.

## Build Quirks

- `build` runs `tsup` then `node scripts/build-css.mjs`; do not call `tsup` alone when verifying published output.
- `tsup.config.ts` emits ESM `.mjs` entries for `index`, `adapters/next`, and `json`, and treats React, Next, lucide, phone input, and CodeMirror packages as externals.
- `scripts/build-css.mjs` compiles `src/styles.css` to `dist/styles.css`, writes `dist/styles.css.d.ts`, prepends OverlayScrollbars CSS, and appends `react-international-phone` CSS when available.
- If Tailwind class names are generated dynamically, update the safelist in `tailwind.config.ts` or the CSS build may purge them.

## Tests

- `bunfig.toml` preloads `test/setup.ts`; it installs happy-dom globals and Testing Library cleanup. Prefer package/root test commands that preserve this preload.
- DOM component tests use `@testing-library/react`; add focused tests beside the existing component area (`test/table`, `test/slider`, `test/tabs`, etc.).
- Keep barrel/export tests passing when adding or renaming public components.

## UI Conventions

- Preserve browser/server separation: Next-only code belongs in `src/adapters/next.tsx`; avoid importing Next APIs from the main `najm-kit` entry.
- Keep optional-heavy editor code behind `najm-kit/json`; do not pull CodeMirror into `src/index.ts` consumers unless the export contract intentionally changes.
- Components should work with host Tailwind plus `najm-kit/styles.css`; changes to tokens or global styles must be verified through the package build, not only the Vite playground.
- The playground aliases `najm-kit` and `najm-kit/styles.css` to `src`, so it is useful for local UI checks but does not prove `dist` exports are correct.
