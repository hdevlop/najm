'use client';

// Deliberately wrong. `najm-theme/server/react` is a React Server Component
// module, and the export map points the `browser` condition at a guard that
// throws at load. This build MUST fail — a build that succeeds means the
// application's internal fetcher and its factory values shipped to a browser.
import { createReactThemeBootstrap } from 'najm-theme/server/react';

export default function Page() {
  return <main>{typeof createReactThemeBootstrap}</main>;
}
