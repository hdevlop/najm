// ============================================================================
// Browser-condition stand-in for najm-auth/client/server/react
// ============================================================================
//
// package.json maps the `browser` export condition here. A bundler compiling
// for the browser — including Next.js compiling a Client Component or the Edge
// runtime — therefore resolves this module instead of the adapter and fails at
// build time with an explanation, rather than shipping a Server Component
// module into a client bundle.
// ============================================================================

throw new Error(
  'najm-auth/client/server/react is a React Server Component module. It cannot be '
  + 'imported from a Client Component, the Edge runtime, or any browser bundle. '
  + 'Use najm-auth/client/react for client components, and najm-auth/client/server '
  + 'for proxy and Edge code.',
);

export {};
