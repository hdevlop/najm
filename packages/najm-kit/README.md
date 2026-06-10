# najm-kit

Reusable React component library for Najm applications. Provides themed UI primitives, hooks, and form components.

## Install

```bash
bun add najm-kit
```

Peer dependencies: `react >=18`, `react-dom >=18`.

Optional peer dependencies: `recharts`, `@tanstack/react-table`, `react-hook-form`, `@tanstack/react-query`.

## Theme Provider

```tsx
import { NajmThemeProvider } from 'najm-kit';

function App() {
  return (
    <NajmThemeProvider appearance={{ mode: 'light', accent: 'indigo' }}>
      {children}
    </NajmThemeProvider>
  );
}
```

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
- Requires Tailwind CSS in the host application
- CodeMirror components are optional peer deps — import from `najm-kit/json` only if needed