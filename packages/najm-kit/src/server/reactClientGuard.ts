// ============================================================================
// Browser-condition stand-in for najm-kit/server/react
// ============================================================================
//
// package.json maps the `browser` export condition here. A bundler compiling
// for the browser — including Next.js compiling a Client Component — resolves
// this module instead of the adapter and fails at build time with an
// explanation, rather than shipping a Server Component module, the app's
// internal fetcher, and its factory values into a client bundle.
// ============================================================================

throw new Error(
  "najm-kit/server/react is a React Server Component module. It cannot be imported "
  + "from a Client Component or any browser bundle. Seed the client from the server "
  + "snapshot through NajmAppProvider instead, and use najm-kit/server for non-render "
  + "server code.",
);

export {};
