'use client';

import { type ReactNode } from 'react';
import { defineNajmDesignConfig, type NajmMode } from 'najm-kit';
import { NajmNextUIProvider } from 'najm-kit/next';

/**
 * The whole UI provider stack for a project without a runtime theme editor.
 *
 * This is the acceptance case for `NajmUIProvider`: a static design config, no
 * translator, and no copied files. Theme state, the design context, `NTable`
 * defaults, the cookie POST to `/api/ui-theme`, and the router refresh all come
 * from the kit. A project that sells a theme editor pays a few more lines to
 * bridge its live design config in; this is the floor.
 */

const design = defineNajmDesignConfig({
  version: 1,
  theme: {},
  components: {},
});

export function UIProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: NajmMode;
}) {
  return (
    <NajmNextUIProvider design={design} initialTheme={initialTheme}>
      {children}
    </NajmNextUIProvider>
  );
}
