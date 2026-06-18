# Najm Theme Studio

A private workspace app for designing [`najm-kit`](../../packages/najm-kit) themes
visually — a Najm-focused tweakcn. Edit global theme tokens, typography, layout,
and per-component style recipes, preview real Najm UI, then export one
consumer-ready JSON file.

## Run

```powershell
bun run theme-studio          # dev server on http://127.0.0.1:4110
bun run build:theme-studio    # production build
bun run theme-studio:preview  # preview the production build
```

`najm-kit` is aliased to source in `vite.config.ts`, so kit edits hot-reload.

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
- **Local persistence** — auto-saves the current draft and named themes to
  `localStorage`.

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
