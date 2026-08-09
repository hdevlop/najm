# najm-kit

Reusable React component library for Najm applications. Provides themed UI primitives, hooks, and form components.

## Install

```bash
bun add najm-kit tailwindcss @tailwindcss/postcss
```

Peer dependencies: `react >=18`, `react-dom >=18`. Requires **Tailwind CSS v4** in the host app.

Optional peer dependencies: `recharts`, `@tanstack/react-table`, `react-hook-form`, `@tanstack/react-query`.

## Styling â€” the entire setup

najm-kit is a Tailwind v4, shadcn-compatible library. PostCSS config (`postcss.config.mjs`):

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

Your global stylesheet â€” **two imports, that's it**:

```css
@import "tailwindcss";
@import "najm-kit/theme.css";
```

This gives you every najm-kit component styled, dark mode wired (the `.dark` class),
and a full token-backed palette you can use in your own markup too
(`bg-background`, `bg-card`, `bg-primary`, `text-muted-foreground`, `border-border`, â€¦).

### Theming

najm-kit uses the **standard shadcn token names** (no prefix), so you rebrand by
overriding CSS variables â€” or paste a theme straight from
[tweakcn](https://tweakcn.com) / the shadcn registry:

```css
:root { --primary: oklch(0.55 0.2 290); --radius: 0.75rem; }
.dark { --primary: oklch(0.70 0.18 290); }
```

Add your own extra colors alongside najm-kit's:

```css
@theme { --color-success: oklch(0.7 0.18 150); } /* â†’ bg-success, text-success */
```

Dark mode: toggle the `dark` class on `<html>` (or any wrapper):

```ts
document.documentElement.classList.toggle("dark");
```

## Theme Provider (optional)

For scoped theming without writing CSS â€” useful for embedded surfaces. The provider
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
<NajmThemeProvider radius="0.75rem">
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
| Forms | Input, Textarea, Label, Select, Checkbox, RadioGroup, Switch, DateInput, FileInput, ImageInput, AvatarInput |
| Feedback | Alert, Badge, Progress, Spinner, Toast |
| Layout | Card, Sheet, Dialog, Popover, DropdownMenu, Tabs |
| Data | Table (NTable), StatCard, DetailList |
| Overlays | Command palette, Tooltip, Toast |

## Images and avatars

Three components, one fallback rule. Each tries its sources in order, tries a
source at most once, and discards what it knows about a failure the moment the
sources change.

### `NImage` — plain `<img>`

For a logo or an icon whose box the caller's CSS already owns. No layout is
invented, and `onError` is forwarded rather than swallowed.

```tsx
import { NImage } from 'najm-kit';

<NImage src={logo} fallback="/brand/logo.svg" alt="Acme" className="h-8 w-auto" />
```

### `NAvatar` — person or record

The image is a native `<img>` loaded directly by the browser, so a same-origin
protected route works with the session the page already has, and the package
needs no knowledge of which routes are protected.

```tsx
import { NAvatar } from 'najm-kit';

<NAvatar
  src={member.image}
  fallbackSrc={stockPortrait}
  version={member.imageRevision}
  title={member.name}
  subtitle={member.role}
  size="lg"
/>
```

- The primary source is tried first, then `fallbackSrc`, then the initials.
- `version` (or `srcVersion`) is appended as `?v=…` to every remote source, so a
  re-upload is not served from cache. `data:` and `blob:` sources are left alone.
- Initials stay visible until an image paints and come back if every source
  fails — a transparent PNG never shows letters through itself.
- `imageProps` reaches the element for `loading`, `sizes`, `crossOrigin`,
  `referrerPolicy`, and the load/error handlers. It defaults to `loading="lazy"`,
  and supplied handlers are composed with the fallback chain rather than
  replacing it.

### `NNextImage` — optimized, from `najm-kit/next`

Same fallback contract with Next's optimizer, layout reservation, `fill`, and
`sizes`. It lives only in the `najm-kit/next` entry, because the root package
stays installable without Next.

```tsx
import { NNextImage } from 'najm-kit/next';

// A public asset: let the optimizer resize and re-encode it.
<NNextImage src="/covers/spring.png" alt="Spring" width={64} height={64} />
```

For an asset the browser must fetch directly — one behind an authenticated route,
typically — the *application* says so:

```tsx
<NNextImage
  src={record.image}
  alt={record.name}
  fill
  sizes="64px"
  unoptimized
/>
```

`unoptimized` is passed at the call site rather than inferred from the URL:
which routes are protected is the application's fact, not something a package
can read off a path. It changes delivery mechanics only — session validation,
permissions, privacy projection, and what bytes come back all remain the
backend's.

## Status badges

`<NBadge status="…" />` already maps a broad lifecycle vocabulary onto the
semantic colors, so it is correct without configuration:

```tsx
import { NBadge } from 'najm-kit';

<NBadge status="out_for_delivery" />   // warning, "Out For Delivery"
<NBadge status="nebulous" />           // neutral, "Nebulous"
```

What an application usually adds on top is the same three things at every call
site: its look, its shape, and its own translated label. Declare them once:

```tsx
<NajmAppProvider
  badgeDefaults={{
    look: 'soft',
    shape: 'pill',
    statusLabelKeys: {
      active: 'status.active',
      out_for_delivery: 'status.outForDelivery',
    },
  }}
>
```

`badgeDefaults` lives on `NajmUIProvider` and is inherited by
`NajmNextUIProvider` and `NajmAppProvider`, so there is one place to set it.
The keys are the application's catalog keys, resolved through the same `t` the
provider already has — this package ships no status catalog. A language change
recomputes every label without a remount.

Resolution, most specific first:

1. An explicit prop beats every provider default.
2. `label` beats string children; string children beat the provider's label.
3. A `statusLabels` literal beats a `statusLabelKeys` catalog lookup.
4. An unmapped status is humanized (`pending_review` → `Pending Review`).
5. A per-instance `statusMap`/`iconMap` merges over the provider's, so
   overriding one status costs one status.
6. Provider status defaults apply **only** when `status` is set —
   `<NBadge>Beta</NBadge>` keeps the ordinary content-badge look.

Statuses are matched through one rule, exported as `normalizeStatusToken`, so
`Out-For-Delivery `, `out for delivery`, and `out_for_delivery` are the same
key for colors, icons, and labels alike. Badge text is presentation: it renames
nothing in the backend and validates no lifecycle transition.

## Global form development tools

Enable schema-driven test values once on the full application provider. Every
`NForm` and `WizardForm` below it then fills from its Zod schema when F8 is
pressed; applications do not need a second provider or a form-fill helper.

```tsx
import { NajmAppProvider } from "najm-kit/app";

<NajmAppProvider formDevTools>
  <App />
</NajmAppProvider>;
```

Pass a boolean to control it from application settings:

```tsx
<NajmAppProvider formDevTools={formFillEnabled}>
  <App />
</NajmAppProvider>
```

Forms with live relation options can override only those fields. The provider
still owns enablement and Najm Kit still owns schema traversal and generation.

```tsx
<NForm
  schema={orderSchema}
  devTools={{ overrides: { customerId: customerOptions } }}
  onSubmit={saveOrder}
>
  {/* fields */}
</NForm>
```

## ImageInput and AvatarInput

`ImageInput` and `AvatarInput` ship with a resilient preview contract so
consumers do not need to wrap them with application-specific preview
components.

Source precedence:

- When `value` is a non-empty string URL, candidates are tried in order:
  1. `value` is the primary preview source.
  2. If the primary source fails, `fallbackImage` is tried when supplied.
  3. `defaultImage` is the last-resort fallback.
- When `value` is `null` or empty, only `defaultImage` is tracked. The
  `fallbackImage` is intentionally not used in the empty state — a null
  `value` is the consumer's empty-state signal, and only the configured
  default participates in the failed-default → unavailable transition.
  If `defaultImage` itself fails, `onPreviewError({ source: "default" })`
  fires and the unavailable state is rendered.

Candidate URLs are deduplicated so the same failing URL is never retried
through multiple stages. When every candidate fails, the broken `<img>` is
unmounted and `unavailableContent` (or a neutral default) is rendered in its
place. A `data-image-input-state="empty" | "preview" | "fallback" | "unavailable"`
marker is exposed for styling, testing, and consumer diagnostics.

Candidate URLs are deduplicated so the same failing URL is never retried
through multiple stages. When every candidate fails, the broken `<img>` is
unmounted and `unavailableContent` (or a neutral default) is rendered in its
place. A `data-image-input-state="empty" | "preview" | "fallback" | "unavailable"`
marker is exposed for styling, testing, and consumer diagnostics.

```tsx
import { ImageInput } from "najm-kit";

<ImageInput
  value="https://cdn.example.com/avatar.png"
  onChange={setAvatar}
  previewAlt="Workspace logo"
  fallbackImage="/assets/logo-default.png"
  fallbackAlt="Default workspace logo"
  unavailableContent={<span>Logo unavailable</span>}
  imageClassName="object-contain"
  imageVersion={cacheBustVersion}
  replaceAriaLabel="Replace workspace logo"
  clearAriaLabel="Remove workspace logo"
  onPreviewError={(err) => log(err)}
/>
```

Key behaviors:

- The replace and clear controls are real `<button>` elements, are reachable
  with the keyboard (`Enter` and `Space` activate them once), and stay
  visible on touch and coarse-pointer devices. Only on `(hover: hover) and
  (pointer: fine)` desktops do the controls fall back to a hover/focus
  reveal. `focus-visible` always restores visibility.
- Positioning uses logical properties (`end-*`) so the clear button works
  correctly in RTL layouts.
- `imageVersion` is appended safely to relative, absolute, queried, and
  fragmented URLs. `data:`, `blob:`, `javascript:`, and `file:` URLs are
  left unchanged.
- File selection is race-safe: stale `FileReader` completions cannot replace
  a newer value, and object URLs created by the component are tracked so
  consumer-owned blob URLs are never revoked.

`AvatarInput` forwards every preview and accessibility prop unchanged while
preserving its circular, size, fill, and camera-icon defaults.

## Formatting

Pure formatters are available from the server-safe `najm-kit/format` entry.
Money values are integer minor units and use the currency's own exponent (for
example MAD has two decimals, JPY zero, and KWD three).

```ts
import { formatCurrency, formatDate, slugify } from 'najm-kit/format';

formatCurrency(12_500, { locale: 'fr-MA', currency: 'MAD' });
formatDate('2026-08-08T20:00:00Z', {
  locale: 'fr-MA',
  timeZone: 'Africa/Casablanca',
});
slugify('Najm Format & Pagination');
```

Client code can use the active locale, time zone, currency, and placeholder
through `useNajmFormat`. `NajmAppProvider` mounts the format provider for you:

```tsx
import { NajmAppProvider } from 'najm-kit/app';
import { useNajmFormat } from 'najm-kit';

<NajmAppProvider
  translations={translations}
  currency="MAD"
  locales={{ en: 'en-MA', fr: 'fr-MA' }}
>
  <App />
</NajmAppProvider>

function Total({ value }: { value: number }) {
  return <span>{useNajmFormat().money(value)}</span>;
}
```

## Offset pagination and queries

`najm-kit/pagination` is server-safe and framework-independent. It accepts
endpoints that return either `{ rows, total }` or a bare row array. When no
total exists it probes for one extra row; when a total exists continuation is
calculated without another request.

```ts
import {
  createOffsetPagination,
  fetchOffsetPage,
} from 'najm-kit/pagination';

const pagination = createOffsetPagination(pageIndex, pageSize);
const page = await fetchOffsetPage(
  ({ limit, offset }) => api.orders.list({ limit, offset }),
  pagination,
);
```

React Query consumers install the optional `@tanstack/react-query` peer and use
the isolated `najm-kit/query` entry. `useResponsiveOffsetList` resolves numbered
desktop paging versus card continuation and exposes props that plug directly
into `NTable` and `createCardPagination`.

```tsx
import { NTable, createCardPagination } from 'najm-kit';
import { useResponsiveOffsetList } from 'najm-kit/query';

const list = useResponsiveOffsetList({
  queryKey: ['orders'],
  fetchPage: ({ limit, offset }) => api.orders.list({ limit, offset }),
  strategy: 'paged',
});

<NTable
  data={list.data}
  columns={columns}
  manualPagination
  pageCount={list.pageCount}
  pagination={list.pagination}
  onPaginationChange={list.onPaginationChange}
  cardPagination={createCardPagination(list, labels)}
/>
```

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
- Uses Radix UI primitives under the hood â€” accessible by default
- All components are unstyled by default â€” apply `buttonVariants()`, `badgeVariants()`, etc. with Tailwind
- Requires Tailwind CSS **v4** in the host application (see Styling above)
- CodeMirror components are optional peer deps â€” import from `najm-kit/json` only if needed

## NTable responsive columns

`NTable` accepts an `NTableColumnDef<T>[]`. Each column's `meta` can carry:

- `visible?: boolean` — app-owned eligibility gate. Defaults to `true`. Set
  this from your role / capability decision. Columns with `visible: false`
  are removed from headers, body cells, the loading skeleton, and the
  column-settings menu.
- `hiddenBelow?: "sm" | "md" | "lg" | "xl" | "2xl"` — hide the table column
  below the chosen Tailwind breakpoint. The column remains visible at that
  breakpoint and above (mobile-first). Table view only.

```tsx
import { NTable, type NTableColumnDef } from "najm-kit";

const columns: NTableColumnDef<Family>[] = [
  { accessorKey: "name", header: "Family account" },
  {
    accessorKey: "email",
    header: "Email",
    meta: {
      visible: can("families.email.read"),
      hiddenBelow: "lg",
    },
  },
];
```

Notes:

- `visible` is **application-owned eligibility**, not an NTable role system.
  `NTable` never imports `najm-auth` or reads a session; convert your own
  role / capabilities to a boolean.
- Omitting `visible` is the same as `true`.
- `hiddenBelow` is table-only. Card view, JSON view, and custom modes
  ignore it. Cards must do their own capability gating inside `renderCard`.
- Hiding a column is **presentation only**. The backend must still enforce
  the permission and privacy-project the field. Never rely on UI hiding to
  protect sensitive data.
- The user-controlled column visibility menu (settings → Columns) keeps
  working independently. It can report a column as selected while CSS
  hides it below the configured breakpoint.
- The columns the TanStack table receives are already filtered, so the
  settings menu will not list `visible: false` columns.

If you need to inspect or build your own effective column list, the same
pure helper is exported as `filterResponsiveColumns`. The literal class
map is also exported as `hiddenBelowClasses`, and
`resolveHiddenBelowClass(breakpoint)` returns the class for a single
breakpoint or `undefined` when no breakpoint is set.

## NTable responsive cards, loading, and pagination

Responsive row actions are visible by default on phone, tablet, and coarse or
non-hover pointers. Fine-pointer desktop layouts may reveal them on hover, but
keyboard focus always reveals the action. Applications still decide which menu
items exist through `menu`, `onView`, `onEdit`, and `onDelete`; visibility does
not grant an action or replace server authorization.

When `dynamicHeight` is enabled, table and card loading skeletons measure the
available body. Table rows use the same header/row geometry as dynamic page
sizing, while cards measure the active grid columns, card height, and gap. The
loading surface also follows the loaded `bordered`, design recipe, radius,
border color, shadow, and `classNames.content`/`classNames.cards` contract.

Use `cardPagination` to choose pagination presentation whenever the effective
rendered mode is cards:

- `{ mode: "paged" }` (the default) preserves existing pagination.
- `{ mode: "all" }` renders every row already supplied and hides the footer.
- `{ mode: "load-more", ... }` renders every supplied row and provides a
  guarded, keyboard-operable Load more/Retry control with polite loading,
  appended-result, and end-of-list announcements.

`showPagination={false}` remains an absolute presentation override and hides
both numbered controls and Load more. In table mode, existing controlled and
manual server pagination remains unchanged.

```tsx
import { NTable, type NTableCardPagination } from "najm-kit";

const cardPagination: NTableCardPagination = {
  mode: "load-more",
  hasNextPage: query.hasNextPage,
  loadingMore: query.isFetchingNextPage,
  loadMoreError: query.isFetchNextPageError
    ? "The next page could not be loaded."
    : undefined,
  onLoadMore: () => query.fetchNextPage(),
  loadMoreLabel: "Load more",
  loadingMoreLabel: "Loading more...",
  retryLabel: "Retry",
  endLabel: "No more results.",
};

<NTable
  data={query.data?.pages.flatMap((page) => page.rows) ?? []}
  columns={columns}
  getRowId={(row) => row.id}
  renderCard={ResultCard}
  cardPagination={cardPagination}
/>
```

The application owns the query, cursor/offset, accumulated pages, cache
invalidation, search/filter/sort semantics, authorization, and privacy
projection. Najm Kit never imports React Query, calls an endpoint, invents a
page size, or treats supplied rows as proof that every database row is loaded.
Client sorting and filtering cover the rows currently supplied unless the
application implements matching server-side behavior.

For a responsive screen that uses current-page data in desktop table mode and
accumulated pages in card mode, keep those two query shapes in the application
and pass the appropriate `data`. Crossing the `<640px` responsive-card
breakpoint does not overwrite the user's chosen view, pagination position,
sorting, filters, expansion, or row selection.

## Theme-backed charts

`NBarChart`, `NLineChart`, `NPieChart`, and `NStatusBreakdown` accept generic
caller-formatted data and use `--chart-1` through `--chart-5` by default.
Colors repeat deterministically after the fifth series or item; set `color` on
an exceptional series/item to override that one value. Each chart accepts
`loading`/`loadingLabel` and renders an accessible shape-matched skeleton.
`NPieChart` and `NDonutCard` accept `size="sm" | "md" | "lg"` or a numeric
pixel diameter and shrink within narrow containers.

```tsx
import { NBarChart, NPieChart } from "najm-kit";

const data = [
  { id: "jan", label: "Jan", values: { received: 12, refunded: 2 } },
  { id: "feb", label: "Feb", values: { received: 18, refunded: 1 } },
];

<NBarChart
  title="Monthly activity"
  data={data}
  series={[
    { id: "received", label: "Received" },
    { id: "refunded", label: "Refunded" },
  ]}
  valueFormatter={(value) => `${value} MAD`}
/>

<NPieChart
  title="Status"
  size={132}
  items={[
    { id: "active", label: "Active", value: 8 },
    { id: "pending", label: "Pending", value: 3 },
  ]}
/>
```

### Server-backed combobox search

`ComboboxInput` and `FormInput type="combobox"` can delegate filtering to a
server by setting `shouldFilter={false}` and handling `onSearchChange`. Use
`loading` and `loadingMessage` while replacement options are being fetched.
Client-side filtering remains the default.

## Person image fallbacks (`najm-kit/person-images`)

A framework-neutral, React-free subpath that resolves person-image fallbacks
for any application. The seven WebP illustrations are embedded as base64 data
URLs in the published bundle, so consumers do not need to copy package files
into `public/` or wire an asset server.

```ts
import { getPersonImage } from "najm-kit/person-images";

const childSrc = getPersonImage({
  image: child.image,
  role: "child",
  gender: child.gender,
});
```

Built-in roles:

| Role     | Default          | Female          | Male            |
| -------- | ---------------- | --------------- | --------------- |
| `child`  | male child art   | female child    | male child      |
| `adult`  | male adult art   | female adult    | male adult      |
| `parent` | male parent art  | female parent   | male parent     |
| `family` | neutral family   | neutral family  | neutral family  |

Resolution precedence, for every call:

1. A real `image` (anything that survives `resolveAvatarSrc`).
2. A per-call `fallback` that is not blank and is not the `noavatar.png`
   sentinel.
3. The configured role's gender variant, or the role's required `default`
   when the variant or the gender is missing.

The per-call `fallback` is treated like a real source: an empty string, a
blank trimmed value, or any `noavatar.png` path falls through to the role
default. The Kafil data is a worked example: children use `role: "child"`,
households use `role: "family"`, sponsors, staff, applicants, and delivery
staff use `role: "adult"`, and a household parent uses `role: "parent"`
after the family dashboard maps its relationship value (`mother`, `mère`,
`madre`, `أم`, …) to `F`, `M`, or `null` at the feature boundary.

### Custom roles

`createPersonImageResolver` returns a typed resolver that accepts the
application's own role names. Unknown role strings fail type checking:

```ts
import { createPersonImageResolver } from "najm-kit/person-images";

const getSmsPersonImage = createPersonImageResolver({
  teacher: {
    default: "/images/teachers/default.webp",
    female: "/images/teachers/female.webp",
    male: "/images/teachers/male.webp",
  },
  student: {
    default: "/images/students/default.webp",
    female: "/images/students/female.webp",
    male: "/images/students/male.webp",
  },
});

const teacherSrc = getSmsPersonImage({
  image: teacher.image,
  role: "teacher",
  gender: teacher.gender,
});
```

The factory merges custom definitions over the built-in map. A custom `child`
override replaces the built-in child art for that application alone — the
package itself is untouched, and other consumers keep their built-in
fallbacks.

Custom paths may be application-relative URLs, managed API URLs, CDN URLs,
or data URLs. najm-kit does not fetch, upload, authorize, or persist them.

### Per-call fallback override

Every call accepts a `fallback`. It overrides the role default for that call
only, after a real `image` and before the role's gender variant:

```ts
getPersonImage({ image: child.image, role: "child", gender: child.gender, fallback: child.placeholder });
```


## Server UI bootstrap (`najm-kit/server`, `najm-kit/server/react`)

An application that renders its own theme and its own logos on the server ends
up writing the same module every time: fetch the public endpoints, unwrap the
`data` envelope, validate the payload, fall back to the built-in assets when
any of that fails, and run the resources in parallel. These two entries own
that mechanism. What stays with the application is what is genuinely
application-specific — how a request reaches its own backend, which paths it
serves, what a valid payload looks like, what the factory values are, and where
a diagnostic goes.

Neither entry is re-exported from `najm-kit`, `najm-kit/next`, or
`najm-kit/app`. `najm-kit/server` imports no React at all, so a route handler
or a plain script can use it.

### The application's one server module

```ts
// src/lib/serverLoader.ts
import "server-only";

import { parseNajmDesignConfig } from "najm-kit/server";
import { createReactServerUiBootstrap } from "najm-kit/server/react";

export const serverUi = createReactServerUiBootstrap({
  fetcher: async (path) => {
    const { server } = await import("@app/server");
    return server.fetch(new Request(`http://internal${path}`));
  },
  resources: {
    appearance: {
      path: "/api/appearance",
      parse: parseAppearance,          // returns undefined or throws to reject
      fallback: getFactoryAppearance,  // called per load
    },
    branding: {
      path: "/api/branding",
      parse: parseBranding,
      fallback: getFactoryBranding,
    },
  },
  onDiagnostic: (diagnostic) => {
    console.warn(`[ui-bootstrap] ${diagnostic.resource} ${diagnostic.reason}`, diagnostic);
  },
});

export const loadServerUiBootstrap = serverUi.load;
export const { appearance: loadServerAppearance, branding: loadServerBranding } =
  serverUi.loaders;
```

`load()` resolves every resource; `loaders.<name>()` and `loadResource(name)`
read one off the same resolution. Resource names, payload types, and the number
of resources are the application's — the snapshot type is inferred from the
`resources` object, so `snapshot.branding` is your branding type and not a
package interface.

### Call the factory once, at module scope

`createReactServerUiBootstrap()` builds one `React.cache()` entry. Calling it
inside a layout, page, or component builds a fresh one per call and shares
nothing. Every server boundary in a render must import the same module.

The cache is React's, so it is request-scoped and nothing else: separate
requests never see each other's snapshot or each other's failure, and a
transient outage is retried on the next request rather than pinned into a
process-global. That also rules out a module `Map`, a module promise,
`unstable_cache`, `"use cache"`, or a durable cache here — every one of them
would leak one visitor's render into another's.

The snapshot is deliberately stable for the length of one render. A settings
surface that saves appearance or branding updates the client provider and then
refreshes or navigates into a new render to observe the persisted result.

Outside a render — route handlers, server actions, scripts — use
`createUiBootstrapLoader()` from `najm-kit/server` directly. There is no request
cache for `cache()` to write to there, so the adapter would silently re-fetch
per call.

### Failure behaviour

Resources fall back independently: a branding outage never discards a valid
appearance. Each failure calls `onDiagnostic` once with a `reason` of
`fetch-failed`, `response-not-ok`, `invalid-json`, `invalid-envelope`, or
`invalid-payload`, plus the path and — for a non-success response — the status.
Diagnostics never carry response bodies, headers, cookies, or raw thrown
values; `error` is a normalized `"<name>: <message>"` for an `Error` and the
value's type for anything else.

A `fallback()` that throws is **not** caught. A missing factory theme is the
application's configuration error, and a second fallback would only hide it.

Falling back is right for *public* appearance and branding, where the worst case
is a visitor seeing the built-in logo. It is not a general rule: do not route
authenticated, financial, or privacy-sensitive reads through this, because a
silent fallback there hides an outage behind plausible-looking data.

### Envelopes

`select` defaults to Najm's `{ data }` envelope. Applications behind a different
envelope pass their own at the loader level or per resource; returning the
payload unchanged is a valid selector, and throwing rejects the response as
`invalid-envelope`.

### Client Components

`najm-kit/server/react` maps the `browser` export condition to a module that
throws, so importing it from a Client Component fails the build with an
explanation rather than shipping the application's fetcher and factory values
into a browser bundle. Seed the client from the server snapshot through
`NajmAppProvider` instead.
