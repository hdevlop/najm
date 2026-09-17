# Application provider examples

The Playground root layout is the runnable full-stack example. It passes one
serializable snapshot, including its allowlisted `app` display defaults, to
`src/providers/AppProviders.tsx`, which mounts the direct provider with
Playground's custom 30-second Query policy.

## Minimal installation

A configuration-only app keeps the dependency-neutral composer. It does not
import the full client entry, so Auth, Kit, Theme, Query, Leaflet, and Google
remain optional:

```tsx
import { NajmNextAppProvider } from 'najm-next/app/react';

export function Providers({ children, snapshot }) {
  return (
    <NajmNextAppProvider snapshot={snapshot} providers={{}}>
      {children}
    </NajmNextAppProvider>
  );
}
```

## Kafil-style Leaflet integration

The app definition owns display and location policy. The server projects the
display defaults and resolved runtime configuration into the snapshot:

```tsx
const app = defineNajmApp({
  // auth, preferences and CSP omitted
  id: 'kafil',
  appName: 'Kafil',
  currency: 'MAD',
  location: true,
});

<NajmAppProvider
  authClient={auth.client}
  snapshot={snapshot}
  i18n={kafilUiI18n}
>
  {children}
</NajmAppProvider>
```

## School-style Google and keyboard integration

Bindings and policy objects are defined once at module scope. School retains
its no-retry behavior, institution currency, Google provider wrapper, and the
keyboard layer inside Query but outside Kit UI:

```tsx
const query = defineNajmTanStackQuery({
  queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 0 },
  mutations: { retry: 0 },
});

const keyboardBinding = bindNajmNextProvider(
  KeyboardProvider,
  () => ({}),
);

<NajmAppProvider
  authClient={auth.client}
  snapshot={snapshot}
  query={query}
  location={{
    Provider: SchoolLocationProvider,
    selectProps: (value) => ({ config: value.settings.locationConfig }),
  }}
  extensions={{ beforeUi: keyboardBinding }}
  i18n={schoolI18n}
>
  {children}
</NajmAppProvider>
```

School's institution-resolved `snapshot.preferences.currency` takes precedence
over any static app default. Its custom Query integration preserves the
no-retry policy; omitting `query` would select Najm's shared defaults.
