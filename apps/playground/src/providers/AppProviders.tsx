'use client';

import type { ServerSession } from 'najm-auth/client/server';
import type { NajmMode } from 'najm-kit';
import type { NajmAppI18n } from 'najm-kit/app';
import { NajmAppProvider } from 'najm-next/app/client';
import { defineNajmTanStackQuery } from 'najm-next/query/tanstack';
import type { PublicAppearance, PublicBranding } from 'najm-theme';
import type { ReactNode } from 'react';

import { auth } from '@/lib/auth';
export interface PlaygroundUiSnapshot {
  app: { appName?: string; currency?: string };
  session: ServerSession | null;
  preferences: {
    language: string;
    theme: NajmMode;
    timeZone: string;
  };
  appearance: PublicAppearance;
  branding: PublicBranding;
  settings: Record<string, never>;
}

const query = defineNajmTanStackQuery({
  queries: { staleTime: 30_000 },
});

export function AppProviders({
  children,
  i18n,
  snapshot,
}: Readonly<{
  children: ReactNode;
  i18n: NajmAppI18n;
  snapshot: PlaygroundUiSnapshot;
}>) {
  return (
    <NajmAppProvider
      authClient={auth.client}
      snapshot={snapshot}
      query={query}
      i18n={i18n}
      formDevTools
    >
      {children}
    </NajmAppProvider>
  );
}
