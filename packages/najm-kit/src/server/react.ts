// ============================================================================
// najm-kit/server/react — one UI bootstrap per React server request
// ============================================================================
//
// A Next.js navigation is not one function. The root layout, every nested
// layout, and the page render separately, and each one that asks for branding
// or appearance pays for its own round trip. Worse, they can disagree: two
// fetches straddling a settings save render one surface with the old logo and
// the next with the new one.
//
// React's `cache()` collapses those into one — but only when every caller goes
// through the *same* memoized function, which means the application must own
// one module that creates it.
//
// @example
// ```ts
// // src/lib/serverLoader.ts
// import "server-only";
//
// import { createReactServerUiBootstrap } from "najm-kit/server/react";
//
// export const serverUi = createReactServerUiBootstrap({
//   fetcher: (path) => server.fetch(new Request(`http://internal${path}`)),
//   resources: { appearance, branding },
//   onDiagnostic: reportUiBootstrapDiagnostic,
// });
//
// export const loadServerUiBootstrap = serverUi.load;
// export const { appearance: loadServerAppearance, branding: loadServerBranding } =
//   serverUi.loaders;
// ```
//
// Call the factory once, at module scope, in a module the whole app imports.
// Calling it inside a layout, page, or component builds a fresh memoization
// entry per call and shares nothing.
//
// The cache is React's, so it is request-scoped and nothing else: separate
// requests never see each other's snapshot or each other's failure, and a
// transient outage is retried on the next request rather than pinned into a
// process-global. That also rules out a module `Map`, a module promise,
// `unstable_cache`, `"use cache"`, or a durable Najm cache here — every one of
// them would leak one visitor's render into another's.
//
// The snapshot is deliberately stable for the length of one render. Code that
// saves appearance or branding must update the client provider and then
// refresh or navigate into a new render to observe the persisted result.
//
// React Server Components only. Route handlers, server actions, and scripts
// keep using `najm-kit/server` directly — outside a render there is no request
// cache for `cache()` to write to, so this would silently re-fetch per call.
// ============================================================================

import * as React from "react";

import {
  createUiBootstrapLoader,
  type UiBootstrapConfig,
  type UiBootstrapResources,
  type UiBootstrapSnapshot,
} from "./uiBootstrap";

export type {
  UiBootstrapConfig,
  UiBootstrapDiagnostic,
  UiBootstrapFailureReason,
  UiBootstrapFetcher,
  UiBootstrapResource,
  UiBootstrapResources,
  UiBootstrapSnapshot,
  UiBootstrapValue,
} from "./uiBootstrap";

export interface ReactServerUiBootstrap<R extends UiBootstrapResources> {
  /** Every resource for this request, resolved once and shared. */
  load(): Promise<UiBootstrapSnapshot<R>>;
  /** One resource, read off the same shared resolution. */
  loadResource<K extends keyof R>(name: K): Promise<UiBootstrapSnapshot<R>[K]>;
  /** `loadResource` pre-bound per name, for destructuring into a facade. */
  loaders: { [K in keyof R]: () => Promise<UiBootstrapSnapshot<R>[K]> };
}

type Cache = <T extends (...args: never[]) => unknown>(fn: T) => T;

export function createReactServerUiBootstrap<R extends UiBootstrapResources>(
  config: UiBootstrapConfig<R>,
): ReactServerUiBootstrap<R> {
  const cache = (React as { cache?: Cache }).cache;
  if (typeof cache !== "function") {
    throw new Error(
      "najm-kit/server/react requires a React version that exports cache() "
      + "(React 18.3 or newer). Upgrade react, or use createUiBootstrapLoader() "
      + "from najm-kit/server directly.",
    );
  }

  const loader = createUiBootstrapLoader(config);

  // Created once per imported module — never per render, per component, or per
  // call — so every caller in a request reaches the same memoization entry.
  const load = cache(loader.load);

  // Derived from the combined load rather than from the loader's own
  // per-resource path. A layout reading branding and a page reading appearance
  // then share one resolution instead of racing two, and a resource that fell
  // back stays fallen back for the whole render.
  const loadResource = async <K extends keyof R>(name: K) => (await load())[name];

  const loaders = Object.fromEntries(
    Object.keys(config.resources).map((name) => [
      name,
      () => loadResource(name as keyof R),
    ]),
  ) as ReactServerUiBootstrap<R>["loaders"];

  return { load, loadResource, loaders };
}
