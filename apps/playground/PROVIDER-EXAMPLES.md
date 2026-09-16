# Application provider examples

The Playground root layout is the runnable full-stack example. It passes one
serializable snapshot to `src/providers/AppProviders.tsx`, which mounts the
direct provider with Playground's 30-second Query policy.

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

The application owns tile and privacy policy. The full provider only selects
the public runtime config from the current snapshot; `geocoder={null}` stays in
the application wrapper:

```tsx
const location = {
  Provider: KafilLocationProvider,
  selectProps: (snapshot: KafilUiSnapshot) => ({
    config: snapshot.settings.locationConfig,
  }),
};

<NajmAppProvider
  authClient={auth.client}
  snapshot={snapshot}
  location={location}
  i18n={kafilUiI18n}
  currency="MAD"
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
  currency={snapshot.preferences.currency}
  i18n={schoolI18n}
>
  {children}
</NajmAppProvider>
```

`SchoolLocationProvider` continues to lazy-load Google Places, localize the
provider options, preserve Place metadata, reset sessions, and supply shared
location labels. Those choices do not belong to the generic provider.
