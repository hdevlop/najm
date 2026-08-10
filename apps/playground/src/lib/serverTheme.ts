import 'server-only';

import { appTheme } from '../../theme';

// ============================================================================
// Playground — the theme snapshot for a React server render
// ============================================================================
//
// The one module this application owns, created once at module scope so React's
// request cache reaches every layout and page through the same memoized loader.
// Calling `appTheme.react()` inside a component would build a fresh entry per
// call and quietly cost one round trip each.
//
// Note what is *not* here: no fetcher, no base path, no factory design, no
// branding map, no diagnostic sink. All of those come from the definition and
// the package's own conventions. What is left is the binding between this
// frontend and this backend, which is the only part a package cannot know.
//
// `getServer` is lazy on purpose. The Najm server opens a database and boots
// every plugin; importing it eagerly from a module the whole app depends on
// would do that during the Next build's module graph evaluation.
// ============================================================================

const serverTheme = appTheme.react({
  getServer: async () => (await import('@/server')).server,
});

export const loadServerTheme = serverTheme.load;
export const loadServerAppearance = serverTheme.loadAppearance;
export const loadServerBranding = serverTheme.loadBranding;
