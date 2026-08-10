import 'server-only';

import { appTheme } from '../theme';

// The one module a consumer owns. Created at module scope, imported by every
// layout and page — that is what makes React's request cache reach them all.
//
// No factory design, no branding map, no base path: the definition carries all
// three, and a Next production build is where a definition that only resolves
// from a source tree would be caught.
const serverTheme = appTheme.react({
  getServer: async () => ({
    fetch: async (request: Request) =>
      new Response(
        JSON.stringify({
          data: request.url.endsWith('/appearance')
            ? { designConfig: { version: 1, theme: { tokens: { primary: '#0ea5e9' } } }, revision: 42 }
            : { slots: { sidebarLogoExpanded: '/uploads/logo.png' }, revision: 7 },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  }),
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
