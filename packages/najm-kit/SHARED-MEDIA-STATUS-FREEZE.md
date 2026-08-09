# Shared Media and Status — Contract Freeze (Move 0)

Status: **FROZEN**

Recorded: 2026-08-09. Companion to `SHARED-MEDIA-STATUS-PLAN.md`.

This file is the pre-change evidence the plan's Move 0 requires: the exact public
declarations before the work, the real Kafil caller inventory, and the behaviors
the new package contract must reproduce. Nothing here is aspirational — every
number was counted, and every signature was copied from source at
`najm-kit@2.9.0`.

## 1. Frozen public declarations

### `NAvatar` — `src/components/Avatar/Avatar.tsx`

```ts
export type AvatarShape = "circle" | "rounded" | "square";

export interface AvatarClassNames {
  root?: string; avatar?: string; image?: string; fallback?: string;
  title?: string; subtitle?: string; meta?: string;
}

export interface AvatarProps {
  src?: string | null;
  title?: string;
  fallback?: string;
  fallbackSrc?: string;
  alt?: string;
  version?: string | number | null;
  srcVersion?: string | number | null;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: AvatarShape;
  subtitle?: string;
  meta?: React.ReactNode;
  className?: string;
  classNames?: AvatarClassNames;
}

export function NAvatar(props: AvatarProps): JSX.Element;
export { NAvatar as Avatar };
export type NAvatarProps = AvatarProps;
export type NAvatarClassNames = AvatarClassNames;
```

Every prop above is source-compatible after the change. The additive delta is
`imageProps`.

### `NImage` — `src/components/ui/NImage.tsx`

```ts
export interface NImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  src: string;
  fallback?: string;
}

export function NImage(props: NImageProps): JSX.Element;
```

`onError` is currently *removed* from the public type — the component owns it.
Restoring it is the additive delta.

### `NBadge` — `src/components/Badge/Badge.tsx`

```ts
export type BadgeColor = "primary" | "secondary" | "accent" | "neutral"
  | "info" | "success" | "warning" | "destructive";
export type BadgeLook = "solid" | "soft" | "outline" | "dash";
export type BadgeDisplayLook = BadgeLook | "minimal" | "text";
export type BadgeSize = "sm" | "md" | "lg";
export type BadgeShape = "default" | "pill" | "square";
export type BadgeVariant = "default" | "secondary" | "destructive"
  | "success" | "warning" | "outline";
export type BadgeIcon = NIconSource;

export type BadgeProps = React.ComponentProps<"span"> & {
  asChild?: boolean;
  variant?: BadgeVariant;
  status?: string;
  statusMap?: Record<string, BadgeColor>;
  label?: string;
  showIcon?: boolean;
  color?: BadgeColor;
  look?: BadgeDisplayLook;
  size?: BadgeSize;
  shape?: BadgeShape;
  icon?: BadgeIcon;
  iconMap?: Record<string, BadgeIcon>;
  iconPosition?: "left" | "right";
};
```

Status helpers already public from the root barrel: `resolveStatusColor`,
`findStatusColor`, `statusTextClass`, `colorTextClass`, `NAJM_STATUS_COLORS`,
`NAJM_COLOR_TEXT_CLASSES`. `normalizeStatus` is **private** today; the plan's
rule 9 makes it public.

### Providers

```ts
// src/providers/NajmUIProvider.tsx
export interface NajmUIProviderProps
  extends Omit<NajmPreferencesProviderProps, "children"> {
  children: React.ReactNode;
  design?: NajmDesignConfig;
  initialDesign?: NajmDesignConfig;
  className?: string;
  t?: NajmTranslate;
  paginationKeyPrefix?: string;
  tableDefaults?: NTableDefaults;
}

// src/adapters/next.tsx
export interface NajmNextUIProviderProps
  extends Omit<NajmUIProviderProps, "onThemeChange" | "onTimeZoneChange"> {
  endpoints?: NajmNextUIEndpoints;
  refreshOnChange?: boolean;
}

// src/adapters/app.tsx
export interface NajmAppProviderProps
  extends Omit<NajmNextUIProviderProps, "t"> {
  formDevTools?: boolean | FormDevToolsOptions;
  translations?: Translations;
  initialLanguage?: string;
  defaultLanguage?: string;
  languageEndpoint?: string;
  appName?: string;
  currency?: string;
  locales?: Record<string, string>;
  locale?: string;
  formatPlaceholder?: string;
  branding?: NBrandingInput;
  initialBranding?: NBrandingInput;
}
```

The inheritance chain is the load-bearing fact: one `badgeDefaults` prop added
to `NajmUIProviderProps` reaches both adapters with no second provider API.
`NajmAppProviderProps` omits only `t`, so it inherits `badgeDefaults` too.

## 2. Kafil caller inventory

Counted at `C:\Users\hdevlop\Desktop\kafil` on 2026-08-09 over `apps/web/src`.

| Wrapper | Render sites | Source files |
|---|---|---|
| `ManagedAvatar` | 35 | 31 |
| `ProtectedImage` | 14 | 13 |
| `StatusBadge` | 43 | 38 |

### 2.1 Image classification

Every `ProtectedImage` call site, classified as the plan's Move 0 requires. No
classification was inferred from a filename.

| Site | Classification | Layout props |
|---|---|---|
| `Categories/CategoryCard.tsx:43` | protected direct (`/api/category-images/…`) | `fill`, `sizes="120px"` |
| `Categories/CategoryCard.tsx:82` | protected direct | `fill`, responsive `sizes` |
| `Categories/CategoryDetails.tsx:17` | protected direct | `width={48} height={48}` |
| `Contributions/ContributionDetails.tsx:175` | protected direct **or** packaged data-URL placeholder, via `getPersonImage` | `fill`, `sizes`, **only site passing `fallbackSrc`** |
| `Dashboard/FamilyDashboardPage.tsx:160` | protected direct | `fill`, `sizes="48px"` |
| `Families/FamilyCard.tsx:154` | protected direct or data-URL placeholder | `fill`, responsive `sizes` |
| `Families/FamilyDetailsHero.tsx:22` | protected direct or data-URL placeholder | `fill`, `sizes` |
| `Families/SponsorContributionSheet.tsx:42` | protected direct or data-URL placeholder | `fill`, `sizes="64px"` |
| `OrderCart/OrderCartDialog.tsx:113` | protected direct (product) | `fill`, `sizes="56px"` |
| `OrderCart/OrderCartDialog.tsx:339` | protected direct or data-URL placeholder | `fill`, `sizes="96px"` |
| `Orders/OrderCard.tsx:64` | protected direct (category) | `width={48} height={48}` |
| `Products/ProductCard.tsx:115` | protected direct (product) | `fill`, responsive `sizes` |
| remaining 2 sites | protected direct | `fill` + `sizes` |

Two facts this makes explicit, and both are Move 7 obligations:

1. **`unoptimized` is currently inferred, not declared.** `isProtectedImageSource`
   prefix-matches seven `/api/*-images/files/serve/` routes. After migration the
   application states `unoptimized` at the call site. The package must never
   learn those prefixes.
2. **A `getPersonImage` source is not always a managed route.** With no stored
   image it returns a packaged `data:image/webp;base64,…` placeholder from
   `najm-kit/person-images`. Those sites therefore alternate between a protected
   route and a data URL at runtime, so Move 7 must set `unoptimized` for the
   whole site rather than branch on the resolved string — the current wrapper
   silently sends the data-URL case through the optimizer, and that is the one
   behavior difference the migration must decide deliberately rather than
   inherit.

### 2.2 `ManagedAvatar` prop usage

| Prop | Sites |
|---|---|
| `classNames` | 24 |
| `size` | 22 |
| `title` | 17 |
| `alt` | 16 |
| `subtitle` | 6 |
| `fallback` | 3 |
| `shape` | 2 |
| `meta` | 2 |
| `fallbackSrc` | 1 |
| `version` / `srcVersion` | **0** |

`src` is `getPersonImage({ … })` at 34 of 35 sites; the exception is
`profile.image ?? undefined`. Cache-version support is therefore contract
surface with no live caller — it must keep working, but no Kafil screen proves
it. Move 5 covers it with package tests instead.

### 2.3 `StatusBadge` prop usage

| Prop | Sites |
|---|---|
| `className` | 19 |
| `icon` | 10 |
| `label` | 8 |
| `size` | 3 |
| `color` | 1 |
| `look` / `shape` / `showIcon` / `statusMap` / `iconMap` | 0 |

The wrapper hard-codes `look="soft" shape="pill"` and spreads caller props
*after* them, so a caller override already wins. Eight sites pass an explicit
`label`, which is why precedence rule 1 (explicit prop beats provider default)
and rule 2 (explicit `label` beats children) are not theoretical.

Kafil's `formatStatusLabel` maps 16 statuses to `status.*` catalog keys and
falls back to `humanizeToken`. It normalizes with `status.trim().toLowerCase()`;
the package's `normalizeStatus` additionally folds spaces and hyphens to
underscores, so it is a strict superset and no Kafil key changes meaning.

`formatStatusLabel` is also called from chart labels, delivery history, detail
copy, and plain text. It stays in Kafil after the badge wrapper is deleted.

## 3. Frozen behavior baseline

Derived from source at `najm-kit@2.9.0` plus `@radix-ui/react-avatar@1.1.11`.
Move 5 re-verifies each row in a real browser against the new implementation.

| Scenario | Behavior today (`ManagedAvatar` / `ProtectedImage` / `StatusBadge`) | Behavior today (`NAvatar` / `NImage` / `NBadge`) |
|---|---|---|
| Transparent avatar loads | Initials unmount on `onLoad`; transparent pixels show the `bg-muted` ring, never text | Radix unmounts `AvatarFallback` at `loaded`; same result |
| Primary source fails | Source pushed to `failedSources`, `fallbackSrc` tried next | **`fallbackSrc` is never tried** — it is only used when `src` is absent. This is the gap Move 2 closes |
| Fallback source also fails | Both in `failedSources`, initials return, no retry loop | N/A (no chain exists) |
| No image at all | Initials from `title`/`fallback`/`alt`, else `?` | Initials from `title`/`fallback`, else `?` |
| Consumer `onLoad`/`onError` | Fire on the real `next/image` element | **Never fire** — Radix preloads with `new window.Image()` and mounts the `<img>` only once loaded, so `loading="lazy"` is also inert |
| Language change | `useKafilLanguage()` re-renders the badge, label recomputes, no remount | No translation path exists |
| Unknown status | `humanizeToken(status)` label, `neutral` color | Same |

The `onLoad`/`onError` row is why Move 2 renders a native `<img>` rather than
Radix's `AvatarImage`: the plan's requirements 5 and 6 (a meaningful lazy
default, composed consumer handlers) are unreachable through a preloading
primitive that discards the events and mounts the element after the fact.

## 4. Gate

- [x] The new package contract covers every real caller without an app-specific
      prop or an unrecorded behavior loss.

Checked against the inventory above:

- Avatar — `imageProps` covers the wrapper's `loading`/`sizes` forwarding;
  `fallbackSrc` chaining covers the one caller that uses it; `classNames`,
  `size`, `shape`, `title`, `subtitle`, `meta`, `alt`, `fallback` already exist.
- Image — `NNextImage` covers `fill`, `sizes`, width/height, `fallbackSrc`, and
  composed `onError`. `unoptimized` moves from inferred to declared, which is a
  deliberate, recorded change of ownership rather than a loss.
- Badge — `badgeDefaults.statusLabelKeys` + `look`/`shape` cover the wrapper's
  entire body. Local `className`, `icon`, `label`, `size`, and `color`
  overrides keep winning by precedence rule 1.

One behavior loss is accepted and recorded rather than silently carried: the
avatar's fallback text is now present until the image actually loads, because
the image is a real lazy `<img>`. Under Radix the fallback was skipped whenever
the browser already had the bytes cached. Both states are correct; the new one
is the one `ManagedAvatar` already shipped.
