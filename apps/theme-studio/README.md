# Najm Theme Studio

A private workspace app for designing [`najm-kit`](../../packages/najm-kit) themes
visually. It runs as a Next.js app with a local Najm API and stores projects and
styles in a dedicated SQLite database.

It has two modes, and they are different products:

| | **Studio** (`/`, `/editor/:id`) | **Managed** (`/managed`) |
|---|---|---|
| Edits | a design *document* | a *running application's* appearance |
| Owned by | this app's own modules | [`najm-theme`](../../packages/najm-theme) |
| Stored in | `theme-studio.db` | `theme-studio-managed.db` |
| Output | exported JSON / TS / CSS | live rows with revisions and uploaded assets |

Neither can overwrite the other, and the managed mode adds nothing to this app but
configuration — no controller, service, hook, DTO, or API client of its own.

## Run

```powershell
bun run --cwd apps/theme-studio db:reset-seed  # create ./theme-studio.db with demo data
bun run theme-studio                         # Next dev server on http://127.0.0.1:4110
bun run build:theme-studio                   # production build
bun run theme-studio:preview                 # preview the production build
```

The app uses `DATABASE_URL || './theme-studio.db'`. The DB file is intentionally
ignored by git and can be recreated with `db:reset-seed`.

Managed mode uses a second file, `MANAGED_DATABASE_URL || './theme-studio-managed.db'`,
created on boot. Both are ignored by git; `bun run --cwd apps/theme-studio clean`
removes them along with uploaded branding assets.

## What it does

- **Colors** — edit every theme token with an OKLCH-aware popover picker
  (`ColorPickerInput mode="popover" output="oklch"`), grouped by category, with
  optional linked tokens (primary→ring, border→input).
- **Typography / Layout / Charts** — global font, radius, border, density, and
  chart palette controls.
- **Components** — overview of styled components; the main path is clicking a
  component in the preview to open its style flyout.
- **Preview** — Dashboard, Components, Forms, Data, Overlays, and Charts tabs
  rendering real `najm-kit` components inside a `NajmDesignProvider`.
- **Preview flyouts** — click a component to select it, double-click / right-click
  to open a flyout that edits the *global* recipe for all components of that type
  (radius, density, border, default variant/size, variant aliases).
- **Import / Export** — import `NajmDesignConfig` or bare `NajmThemeConfig` JSON;
  export as JSON, TypeScript, CSS variables, or a usage snippet.
- **Project/style library** — create local projects, save styles, Save As new
  variants, duplicate/delete styles, and mark a default style.
- **Local persistence** — stores projects and styles in `theme-studio.db` through
  the Najm API under `/api/theme-projects` and `/api/theme-styles`.

## Managed mode (`/managed`)

`najm-theme` driving a running application, wired exactly as a real consumer wires
it. Nothing here is a mock: the plugin is registered in
[`src/server/index.ts`](src/server/index.ts) and the package is resolved through
`node_modules` to its **published build** — no tsconfig path, no bundler alias.
That is deliberate; a source alias would hide precisely the bugs a published
package has.

- **Live appearance** — the settings UI pushes its draft into `najm-kit`'s design
  editor, so the surrounding page repaints as you edit, before anything is saved.
- **Server snapshot** — the page is a React Server Component that reads through
  `najm-theme/server/react`, so the first paint is the managed appearance rather
  than a default that flashes. Appearance and branding resolve independently.
- **Presets** — save, list, and apply, against the package's own limits.
- **Branding, standard and custom** — the four slots the package ships plus two
  this app invented (`reportHeaderMark`, `emailFooterIcon`) with their own size
  caps, MIME restrictions, inheritance, and labels. The package renders controls
  for slots it has never heard of.
- **Composition examples** — the same provider and components rendered as a page,
  as a stacked sheet with the action bar in its footer, and as a dialog holding a
  single section.
- **Partial features** — appearance-only and branding-only providers on the same
  page. `features` can only narrow what the backend enabled, never widen it.
- **Revisions** — a stale write answers `409` with the current revision, which the
  status component surfaces and offers to reload.

Authorization is `isLocalStudio()` in [`src/server/config/guards.ts`](src/server/config/guards.ts):
the request must have arrived over loopback. It is not an authentication scheme
and is not offered as one — `najm-theme` refuses to register without explicit
guards on every mutation, and this is the honest answer for a local design tool.
A real application passes `isAdmin()` or its own equivalent in the same place.

## Using an exported theme in a consumer app

```tsx
import "tailwindcss";
import "najm-kit/theme.css";
import { NajmDesignProvider, parseNajmDesignConfig } from "najm-kit";
import designJson from "./najm-theme.json";

const design = parseNajmDesignConfig(designJson);

export function Root() {
  return (
    <NajmDesignProvider config={design}>
      <App />
    </NajmDesignProvider>
  );
}
```

`NajmDesignProvider` wraps `NajmThemeProvider` (theme tokens) and additionally
applies typography CSS variables and exposes component recipes via context.
Wired components (`Button`, `Badge`, `NCard`, …) read their recipe through
`useNajmComponentStyle`; explicit props always win over design defaults.
