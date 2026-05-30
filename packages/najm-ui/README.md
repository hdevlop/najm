# najm-ui

Reusable React component library for Najm applications. Provides themed UI primitives, hooks, and form components.

## Install

```bash
bun add najm-ui
```

Peer dependencies: `react >=18`, `react-dom >=18`.

Optional peer dependencies: `recharts`, `@tanstack/react-table`, `react-hook-form`, `@tanstack/react-query`.

## Theme Provider

```tsx
import { NajmThemeProvider } from 'najm-ui';

function App() {
  return (
    <NajmThemeProvider appearance={{ mode: 'light', accent: 'indigo' }}>
      {children}
    </NajmThemeProvider>
  );
}
```

## Components

Import from `najm-ui`:

```tsx
import { Button, buttonVariants } from 'najm-ui';
import { Input } from 'najm-ui';
import { Card, CardHeader, CardTitle, CardContent } from 'najm-ui';
import { Dialog, DialogContent, DialogTrigger } from 'najm-ui';
import { DataTable } from 'najm-ui';
import { Form, FormInput, useNForm } from 'najm-ui';
```

### Available Primitives

| Category | Components |
|----------|-----------|
| Actions | Button, IconButton, toggleVariants |
| Forms | Input, Textarea, Label, Select, Checkbox, RadioGroup, Switch, DateInput, FileInput |
| Feedback | Alert, Badge, Progress, Spinner, Toast |
| Layout | Card, Sheet, Dialog, Popover, DropdownMenu, Tabs |
| Data | Table (NTable), StatCard, DetailList |
| Overlays | Command palette, Tooltip, Toast |

## Hooks

```tsx
import { useKeyboard } from 'najm-ui';
import { useDelayedLoading } from 'najm-ui';
import { useClickOutside } from 'najm-ui';
import { useDebouncedValue } from 'najm-ui';
import { useInfiniteScroll } from 'najm-ui';
import { useSelection } from 'najm-ui';
```

## Production Notes

- Designed for dashboard/admin UIs in Najm-powered applications
- Uses Radix UI primitives under the hood — accessible by default
- All components are unstyled by default — apply `buttonVariants()`, `badgeVariants()`, etc. with Tailwind
- Requires Tailwind CSS in the host application
- CodeMirror components are optional peer deps — import from `najm-ui/json` only if needed