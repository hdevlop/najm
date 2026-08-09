import { createReactThemeBootstrap } from 'najm-theme/server/react';
import { server } from './index';
import { factoryBranding, factoryDesign } from './config/theme';

/**
 * One theme snapshot per React server request.
 *
 * Built at module scope, deliberately. `createReactThemeBootstrap` memoizes
 * through React's `cache()`, and calling the factory inside a layout or a page
 * would create a fresh memoization entry per call — which looks identical and
 * quietly costs a round trip per component.
 *
 * The fetcher goes straight back into the in-process server rather than over
 * the network: Theme Studio serves its API from the same Next process, so a
 * loopback HTTP hop would only add a socket. `localhost` is the authority the
 * managed guards check, and these two reads are public anyway.
 */
const serverTheme = createReactThemeBootstrap({
  fetcher: (path) => server.fetch(new Request(`http://localhost${path}`)),
  basePath: '/api/theme',
  factory: { appearance: () => factoryDesign, branding: factoryBranding },
  onDiagnostic: (diagnostic) =>
    console.warn('[theme:rsc]', diagnostic.resource, diagnostic.reason, diagnostic.status ?? ''),
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
