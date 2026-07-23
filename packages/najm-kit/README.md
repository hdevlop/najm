# najm-kit

Reusable React component library for Najm applications. Provides themed UI primitives, hooks, and form components.

## Install

```bash
bun add najm-kit tailwindcss @tailwindcss/postcss
```

Peer dependencies: `react >=18`, `react-dom >=18`. Requires **Tailwind CSS v4** in the host app.

Optional peer dependencies: `recharts`, `@tanstack/react-table`, `react-hook-form`, `@tanstack/react-query`.

## Styling — the entire setup

najm-kit is a Tailwind v4, shadcn-compatible library. PostCSS config (`postcss.config.mjs`):

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

Your global stylesheet — **two imports, that's it**:

```css
@import "tailwindcss";
@import "najm-kit/theme.css";
```

This gives you every najm-kit component styled, dark mode wired (the `.dark` class),
and a full token-backed palette you can use in your own markup too
(`bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`, `border-border`, …).

### Theming

najm-kit uses the **standard shadcn token names** (no prefix), so you rebrand by
overriding CSS variables — or paste a theme straight from
[tweakcn](https://tweakcn.com) / the shadcn registry:

```css
:root { --primary: oklch(0.55 0.2 290); --radius: 0.75rem; }
.dark { --primary: oklch(0.70 0.18 290); }
```

Add your own extra colors alongside najm-kit's:

```css
@theme { --color-success: oklch(0.7 0.18 150); } /* → bg-success, text-success */
```

Dark mode: toggle the `dark` class on `<html>` (or any wrapper):

```ts
document.documentElement.classList.toggle("dark");
```

## Theme Provider (optional)

For scoped theming without writing CSS — useful for embedded surfaces. The provider
is opt-in: with no props it injects nothing and your `:root`/`.dark` CSS owns theming.

```tsx
import { NajmThemeProvider } from 'najm-kit';

// preset:
<NajmThemeProvider preset="dark-blue">{children}</NajmThemeProvider>

// or mode + accent:
<NajmThemeProvider mode="dark" accent="emerald">{children}</NajmThemeProvider>

// shadcn-style global radius scale:
<NajmThemeProvider radius="0.75rem">{children}</NajmThemeProvider>

// exact same radius for cards, tables, buttons, inputs, dialogs, etc.:
<NajmThemeProvider radius="0.75rem" radiusScale="uniform">
  {children}
</NajmThemeProvider>
```

`rounded-full` and `rounded-none` remain explicit, so avatars, pills, switches,
and square variants keep their intended shape.

### JSON theme settings

Store one theme object in a JSON file, local storage, or your settings API:

```json
{
  "mode": "dark",
  "accent": "violet",
  "radius": "0.75rem",
  "radiusScale": "uniform",
  "appearance": { "borderWidth": "1px" },
  "tokens": {
    "primary": "oklch(0.62 0.2 290)",
    "primary-foreground": "oklch(1 0 0)",
    "sidebar": "oklch(0.18 0.02 290)",
    "chart-1": "oklch(0.70 0.20 40)"
  }
}
```

Load and apply it from the same settings state used by your theme editor:

```tsx
import rawTheme from './theme.json';
import { NajmThemeProvider, parseNajmThemeConfig } from 'najm-kit';

const initialTheme = parseNajmThemeConfig(rawTheme);

function App() {
  const [theme, setTheme] = useState(initialTheme);

  return (
    <NajmThemeProvider config={theme}>
      <SettingsPage value={theme} onChange={setTheme} />
      {children}
    </NajmThemeProvider>
  );
}
```

Changing the state updates the complete theme immediately. Use
`stringifyNajmThemeConfig(theme)` when persisting it, and parse settings loaded
from an API or local storage with `parseNajmThemeConfig` before applying them.

## Components

Import from `najm-kit`:

```tsx
import { NButton, buttonVariants } from 'najm-kit';
import { Input } from 'najm-kit';
import { Card, CardHeader, CardTitle, CardContent } from 'najm-kit';
import { Dialog, DialogContent, DialogTrigger } from 'najm-kit';
import { DataTable } from 'najm-kit';
import { Form, FormInput, useNForm } from 'najm-kit';
```

### Available Primitives

| Category | Components |
|----------|-----------|
| Actions | NButton, IconButton, toggleVariants |
| Forms | Input, Textarea, Label, Select, Checkbox, RadioGroup, Switch, DateInput, FileInput |
| Feedback | Alert, Badge, Progress, Spinner, Toast |
| Layout | Card, Sheet, Dialog, Popover, DropdownMenu, Tabs |
| Data | Table (NTable), StatCard, DetailList |
| Overlays | Command palette, Tooltip, Toast |

## Hooks

```tsx
import { useKeyboard } from 'najm-kit';
import { useDelayedLoading } from 'najm-kit';
import { useClickOutside } from 'najm-kit';
import { useDebouncedValue } from 'najm-kit';
import { useInfiniteScroll } from 'najm-kit';
import { useSelection } from 'najm-kit';
```

## Production Notes

- Designed for dashboard/admin UIs in Najm-powered applications
- Uses Radix UI primitives under the hood — accessible by default
- All components are unstyled by default — apply `buttonVariants()`, `badgeVariants()`, etc. with Tailwind
- Requires Tailwind CSS **v4** in the host application (see Styling above)
- CodeMirror components are optional peer deps — import from `najm-kit/json` only if needed
