'use client';

import type { ReactNode } from 'react';
import {
  bindNajmNextProvider,
  NajmNextAppProvider,
  type NajmNextProviderBinding,
} from 'najm-next/app/react';

type PublicSnapshot = {
  session: unknown;
  settings: unknown;
};

type FixtureQueryClient = { readonly id: string };

function FixtureProvider({ name, children }: { name: string; children: ReactNode }) {
  return <div data-fixture-provider={name}>{children}</div>;
}

function binding(name: string): NajmNextProviderBinding<PublicSnapshot, FixtureQueryClient> {
  return bindNajmNextProvider(FixtureProvider, () => ({ name }));
}

const common = {
  auth: binding('auth'),
  query: binding('query'),
  ui: binding('ui'),
  branding: binding('branding'),
} as const;

const kafilProviders = { ...common, location: binding('leaflet') } as const;
const schoolProviders = { ...common, location: binding('google') } as const;
const schoolExtensions = { beforeUi: binding('keyboard') } as const;

export function KafilClientProviders({
  snapshot,
  children,
}: {
  snapshot: PublicSnapshot;
  children: ReactNode;
}) {
  return (
    <NajmNextAppProvider
      snapshot={snapshot}
      createQueryClient={() => ({ id: 'kafil-query' })}
      providers={kafilProviders}
    >
      {children}
    </NajmNextAppProvider>
  );
}

export function SchoolClientProviders({
  snapshot,
  children,
}: {
  snapshot: PublicSnapshot;
  children: ReactNode;
}) {
  return (
    <NajmNextAppProvider
      snapshot={snapshot}
      createQueryClient={() => ({ id: 'school-query' })}
      providers={schoolProviders}
      extensions={schoolExtensions}
    >
      {children}
    </NajmNextAppProvider>
  );
}
