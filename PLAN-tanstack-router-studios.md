# TanStack Router Migration — All Studios

## Shared Pattern

Every studio follows the same routing architecture:

```
src/routes/
├── router.tsx          ← createRouter + route tree + type registration
├── __root.tsx          ← layout (NSidebar + Outlet + global UI)
├── index.tsx           ← / → dashboard
└── [view].tsx          ← one file per view
```

**Rules:**
1. One `createRoute()` per view — flat, no nesting (except knowledge subpaths in rag-studio)
2. Search params via `validateSearch` — no manual URL parsing
3. Layout lives in `__root.tsx` — sidebar, error boundary, global overlays
4. `App.tsx` becomes just `<RouterProvider router={router} />`
5. Navigation via `useNavigate()` or `<Link>` — no `useState` for active view
6. Active sidebar state from `useRouterState()` — no separate tracking

**Embedded package constraints:**

- These studios are published component libraries and can be imported together in the same host TypeScript app. Do **not** leak three conflicting global `Register.router` module augmentations from package `.d.ts` output. Either omit module augmentation in the libraries, keep it in test/demo-only files that are not exported, or use local typed route helpers instead of public global registration.
- The host route must be able to serve every client-side studio path on refresh. Use one of:
  - A catch-all host route, e.g. `storage-studio/[[...slug]]/page.tsx` and `wa-studio/[[...slug]]/page.tsx`.
  - Hash routing for embedded studios.
  - A basepath strategy where all generated paths remain under the mounted host page and the host exposes that subtree.
- Preserve existing provider-level mount path configuration. RAG already exposes `basePath`; if Storage/WhatsApp need path routing under a host page, add a similar optional provider prop or use an internal basename derived from the current page.
- Add `@tanstack/react-router` to each studio package manifest and to each studio `tsup.config.ts` `external` list unless there is an explicit decision to bundle it.

---

## Step 1: Install (all studios)

```bash
bun --cwd packages/najm-rag-studio add @tanstack/react-router
bun --cwd packages/najm-storage-studio add @tanstack/react-router
bun --cwd packages/najm-whatsapp-studio add @tanstack/react-router
```

Then add `@tanstack/react-router` to `external` in:

- `packages/najm-rag-studio/tsup.config.ts`
- `packages/najm-storage-studio/tsup.config.ts`
- `packages/najm-whatsapp-studio/tsup.config.ts`

---

## Step 2: Shared route file pattern

### `routes/router.tsx`

```tsx
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree';

export const router = createRouter({
  routeTree,
  basepath: '/',  // override from provider/mount context where needed
});
```

Do not put `declare module '@tanstack/react-router'` in exported package code for these studios. A host can import multiple studios at once, and TanStack's `Register.router` augmentation is global. If local type registration is still desired for development, keep it in a package-local dev/test-only file excluded from emitted declarations.

### `routes/__root.tsx`

```tsx
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { NSidebar, NErrorBoundary } from 'najm-ui';

export const rootRoute = createRootRoute({
  component: StudioLayout,
});

function StudioLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activePath = pathToNavId(pathname);

  const handleNavigate = (href: string) => {
    navigate({ to: NAV_TO_PATH[href] ?? '/' });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <NSidebar
        navItems={navItems}
        activePath={activePath}
        onNavigate={handleNavigate}
        {/* ...studio-specific sidebar props */}
      />
      <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        <NErrorBoundary fallbackTitle="Something went wrong">
          <Outlet />
        </NErrorBoundary>
      </main>
      {/* ...studio-specific global UI (settings sheet, upload tray, etc.) */}
    </div>
  );
}
```

### `routes/[view].tsx` (leaf route pattern)

```tsx
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { SomeView } from '@/features/some-view';

export const someViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/some-view',
  component: SomeView,
});

// With search params:
export const someViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/some-view',
  validateSearch: (search: Record<string, unknown>) => ({
    filter: search.filter ? String(search.filter) : undefined,
  }),
  component: () => {
    const { filter } = someViewRoute.useSearch();
    return <SomeView filter={filter} />;
  },
});
```

### `routes/routeTree.tsx`

```tsx
import { rootRoute } from './__root';
import { indexRoute } from './index';
import { someViewRoute } from './someView';
// ...all routes

export const routeTree = rootRoute.addChildren([
  indexRoute,
  someViewRoute,
  // ...
]);
```

### Updated `App.tsx`

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/routes/router';

export function StudioApp() {
  return <RouterProvider router={router} />;
}
```

For routes that need dynamic provider state in `beforeLoad` (for example RAG knowledge enablement), `App.tsx` should instead be a small wrapper:

```tsx
export function StudioApp() {
  const { enableKnowledge } = useStudioSettings();
  return <RouterProvider router={router} context={{ enableKnowledge }} />;
}
```

Use `createRootRouteWithContext<StudioRouterContext>()` for those studios.

---

## Step 3: Per-studio route tables

### najm-rag-studio (11 routes + 2 redirects)

| Path | Component | Search Params | Nav ID |
|------|-----------|---------------|--------|
| `/` | `Dashboard` | — | `dashboard` |
| `/knowledge/documents` | `KnowledgeWorkspace` view="documents" | — | `knowledge-documents` |
| `/knowledge/chunks` | `KnowledgeWorkspace` view="chunks" | — | `knowledge-chunks` |
| `/knowledge/chat` | `KnowledgeWorkspace` view="chat" | — | `knowledge-chat` |
| `/tools` | `ToolsView` | — | `routing-tools` |
| `/semantics` | `SemanticsView` | `view?: 'table'\|'json'\|'files'`, `group?`, `lang?` | `routing-semantics` |
| `/lab` | `LabView` | — | `routing-lab` |
| `/tests` | `TestsView` | `view?: 'table'\|'json'\|'files'` | `routing-tests` |
| `/chat` | `StudioChat` | — | `chat` |
| `/logs` | `LogsWorkspace` | — | `logs` |
| `/unmatched` | `UnmatchedInbox` | — | `logs-unmatched` |

**Redirects:**
- `/storage/semantics` → `/semantics?view=files`
- `/storage/tests` → `/tests?view=files`

**Provider base path:** Preserve `RagStudioProvider.basePath`. Replace `studioBasePath.ts` with router/history configuration that uses this provider prop, for example by creating the router with a basename/basepath derived from provider context or by exposing a `RagRouterProvider` wrapper that receives `basePath`.

**Knowledge guard:** `/knowledge/*` routes use `beforeLoad` to redirect to `/lab` when `enableKnowledge === false`. This must use typed router context:

- Define `StudioRouterContext = { enableKnowledge: boolean }`.
- Create the root route with `createRootRouteWithContext<StudioRouterContext>()`.
- Render `<RouterProvider router={router} context={{ enableKnowledge }} />` from a component that can call `useStudioSettings()`.

Do not attempt to read React hooks directly inside `beforeLoad`.

**File-view search migration:** `SemanticsView` and `TestRunner` currently call `readFileViewUrlState()`, `getStoredFileViewMode()`, and `writeFileViewUrl()` from `shared/utils/fileViewUrl.ts`. Replace those with route search state:

- `/semantics` search: `view?: 'table' | 'json' | 'files'`, `group?: string`, `lang?: string`.
- `/tests` search: `view?: 'table' | 'json' | 'files'`, plus any file selection params needed by `TestRunner`.
- Preserve the current localStorage fallback behavior by reading the legacy localStorage keys only when the search param is missing.
- Use `navigate({ search: (prev) => ({ ...prev, view, group, lang }) })` instead of `window.history.replaceState`.

**Files to delete:**
- `shared/hooks/useWorkspace.ts`
- `shared/utils/studioBasePath.ts` → replaced by `basepath` in router config
- `shared/utils/fileViewUrl.ts` → replaced by route search params
- `app/components/WorkspaceRouter.tsx` → replaced by `<Outlet />`

**Replace `setActiveWorkspace` calls in:**
- `Dashboard` `onNavigate` prop
- `StudioChat` `onNavigate` prop
→ Use `useNavigate()` or accept a navigate callback from the route component.

---

### najm-storage-studio (2 routes)

| Path | Component | Search Params | Nav ID |
|------|-----------|---------------|--------|
| `/` | `DashboardView` | — | `dashboard` |
| `/explorer` | `ExplorerView` | `bucket: string`, `prefix?: string`, `view?: 'list'\|'grid'` | `bucket:{name}` |

**Host route:** In the playground, change `apps/playground/src/app/storage-studio/page.tsx` to a catch-all route such as `storage-studio/[[...slug]]/page.tsx`, or use hash routing. Without this, `/storage-studio/explorer?...` will 404 on refresh.

**Missing bucket behavior:** `/explorer` without a valid `bucket` must not crash. Choose and test one behavior:

- Redirect to `/` dashboard.
- Redirect to the first available bucket after buckets load.
- Render an empty/select-bucket state.

**Sidebar `activePath` logic:**
```tsx
const search = explorerRoute.useSearch({ strict: false });
const activePath = search?.bucket ? `bucket:${search.bucket}` : 'dashboard';
```

**Sidebar `onNavigate` logic:**
```tsx
if (href.startsWith('bucket:')) {
  navigate({ to: '/explorer', search: { bucket: href.slice(7), prefix: '', view: 'grid' } });
} else {
  navigate({ to: '/' });
}
```

**Prefix/view changes** use `navigate({ search: (prev) => ({ ...prev, prefix: next }) })`.

Use per-segment URL encoding for bucket/prefix values when generating links, and rely on `validateSearch` for decoding/coercion.

**Files to delete:**
- `app/urlState.ts`

**Update:**
- `CommandPalette` — replace `onSelectBucket`/`onSelectPanel` with `useNavigate()`

---

### najm-whatsapp-studio (11 routes)

| Path | Component | Search Params | Nav ID |
|------|-----------|---------------|--------|
| `/` | `DashboardView` | — | `dashboard` |
| `/instances` | `InstancesView` | — | `instances` |
| `/conversations` | `ConversationsView` | `jid?: string` | `conversations` |
| `/contacts` | `ContactsView` | — | `contacts` |
| `/groups` | `GroupsView` | — | `groups` |
| `/chat-ops` | `ChatOpsView` | `jid?: string` | `chat-ops` |
| `/labels` | `LabelsView` | `jid?: string` | `labels` |
| `/bot` | `BotView` | — | `bot` |
| `/webhooks` | `WebhooksView` | — | `webhooks` |
| `/profile` | `ProfileView` | — | `profile` |
| `/settings` | `SettingsView` | — | `settings` |

**`jid` sharing:** Each route owns its own `?jid=` param. When navigating from conversations to chat-ops, pass it: `navigate({ to: '/chat-ops', search: { jid } })`.

**Host route:** In the playground, change `apps/playground/src/app/wa-studio/page.tsx` to a catch-all route such as `wa-studio/[[...slug]]/page.tsx`, or use hash routing. Without this, `/wa-studio/instances` and other deep links will 404 on refresh.

**Selected JID migration:** Replace `selectedJid` React state in `App.tsx` with route search params:

- `ConversationsView` reads `jid` from `/conversations?jid=...`.
- Selecting a conversation navigates with `search: { jid }`.
- `ChatOpsView` and `LabelsView` read their own `jid` search param.
- When navigating from conversations to chat-ops or labels, explicitly preserve/pass the current `jid`.

**CustomEvent listener:** Move `wa-studio:navigate` handler to `__root.tsx`, map panel IDs to paths.

**localStorage fallback (optional):** On initial load at `/`, check `wa-studio.activePanel` in localStorage and redirect if set.

**Files to delete:**
- `shared/hooks/useActiveView.ts`

---

## Step 4: Path ↔ Nav ID mapping (per studio)

Each studio defines a `NAV_TO_PATH` map and a reverse `pathToNavId()` function in `__root.tsx`. This is the only studio-specific routing logic.

---

## What gets deleted (summary)

| Studio | Files removed |
|--------|--------------|
| rag-studio | `useWorkspace.ts`, `studioBasePath.ts`, `fileViewUrl.ts`, `WorkspaceRouter.tsx` |
| storage-studio | `urlState.ts` |
| whatsapp-studio | `useActiveView.ts` |

---

## Migration order

1. **whatsapp-studio** — simplest (11 flat routes, no URL sync to preserve, no search params except `jid`)
2. **storage-studio** — small (2 routes) but has search param complexity (bucket/prefix/view)
3. **rag-studio** — most complex (redirects, knowledge guard, base path, search params)

---

## Checklist (applies to all three)

- [ ] Install `@tanstack/react-router`
- [ ] Add `@tanstack/react-router` to each studio `tsup.config.ts` external list or document why it is bundled
- [ ] Avoid emitted global `Register.router` module augmentation conflicts across the three published packages
- [ ] Ensure host apps expose catch-all routes or use hash routing for deep-link refresh
- [ ] Create `routes/router.tsx`
- [ ] Create `routes/routeTree.tsx`
- [ ] Create `routes/__root.tsx` (layout)
- [ ] Create `routes/index.tsx` (dashboard)
- [ ] Create all view route files
- [ ] Wire search params where needed
- [ ] Update `App.tsx` to `<RouterProvider />`
- [ ] Replace all `setPanel` / `setActiveWorkspace` / `navigateTo` calls with `useNavigate()`
- [ ] Delete old navigation files
- [ ] Test: every view renders at its URL
- [ ] Test: browser back/forward
- [ ] Test: deep links on refresh
- [ ] Test: sidebar active state matches route
- [ ] Test: all three studios can be imported by the playground TypeScript app without TanStack `Register.router` type conflicts
