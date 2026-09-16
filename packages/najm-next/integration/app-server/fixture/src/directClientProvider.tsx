'use client';

import { createAuthClient } from 'najm-auth/client';
import { NajmAppProvider } from 'najm-next/app/client';
import type { ReactNode } from 'react';

const authClient = createAuthClient({ baseURL: '/api' });

export interface DirectFixtureSnapshot {
  session: null;
  preferences: {
    language: string;
    theme: 'light' | 'dark';
    timeZone: string;
  };
  appearance: {
    designConfig: {
      version: 1;
      theme: Record<string, never>;
      components: Record<string, never>;
    };
    revision: number;
  };
  branding: { slots: Record<string, never>; revision: number };
  settings: { locationConfig: { provider: 'disabled' } };
}

export function DirectClientProvider({
  children,
  snapshot,
}: Readonly<{ children: ReactNode; snapshot: DirectFixtureSnapshot }>) {
  return (
    <NajmAppProvider
      authClient={authClient}
      snapshot={snapshot}
      i18n={{
        translations: { en: { fixture: 'Direct provider' } },
        defaultLanguage: 'en',
        supportedLanguages: ['en'],
      }}
      appName="Direct fixture"
      currency="MAD"
    >
      {children}
    </NajmAppProvider>
  );
}
