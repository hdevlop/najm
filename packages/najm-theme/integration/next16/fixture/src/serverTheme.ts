import 'server-only';

import { createReactThemeBootstrap } from 'najm-theme/server/react';

// The one module a consumer owns. Created at module scope, imported by every
// layout and page — that is what makes React's request cache reach them all.
const serverTheme = createReactThemeBootstrap({
  fetcher: async (path) =>
    new Response(
      JSON.stringify({
        data: path.endsWith('/appearance')
          ? { designConfig: { version: 1, theme: { tokens: { primary: '#0ea5e9' } } }, revision: 42 }
          : { slots: { sidebarLogoExpanded: '/uploads/logo.png' }, revision: 7 },
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  basePath: '/api/theme',
  factory: {
    appearance: () => ({ version: 1, theme: {} }),
    branding: () => ({ sidebarLogoExpanded: '/brand/logo.svg' }),
  },
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
