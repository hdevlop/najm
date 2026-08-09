// ============================================================================
// Browser-condition stand-in for najm-theme/server/react
// ============================================================================
//
// `package.json` maps the `browser` export condition here. A bundler compiling
// for the browser — including Next.js compiling a Client Component — resolves
// this module instead of the adapter and fails at build time with an
// explanation, rather than shipping the application's internal fetcher and its
// factory values into a client bundle.
//
// Throwing at module scope is the point: an export that merely warned would let
// the build succeed and the leak ship.
// ============================================================================

throw new Error(
  "najm-theme/server/react is a React Server Component module. It cannot be imported "
  + "from a Client Component or any browser bundle. Seed the client from the server "
  + "snapshot by passing it into NThemeSettingsProvider, and use najm-theme/server "
  + "for non-render server code.",
);

export {};
