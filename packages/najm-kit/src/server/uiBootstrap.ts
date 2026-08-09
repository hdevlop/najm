// ============================================================================
// najm-kit/server — public UI bootstrap loading
// ============================================================================
//
// Every Najm application that renders its own theme and its own logos on the
// server writes the same module: fetch the public endpoints, unwrap the `data`
// envelope, validate the payload, fall back to the built-in assets when any of
// that fails, and do it for each resource in parallel. Written per app that
// module drifts — one app forgets the parallel fetch, another lets a branding
// outage discard a perfectly good theme, a third logs the response body.
//
// This is that module, once. What stays with the application is everything
// genuinely application-specific: how a request reaches its own backend, which
// paths it serves, what a valid payload looks like, what the factory values
// are, and where a diagnostic goes.
//
// @example
// ```ts
// const ui = createUiBootstrapLoader({
//   fetcher: (path) => server.fetch(new Request(`http://internal${path}`)),
//   resources: {
//     appearance: { path: "/api/appearance", parse: parseAppearance, fallback: factoryAppearance },
//     branding: { path: "/api/branding", parse: parseBranding, fallback: factoryBranding },
//   },
// });
//
// const { appearance, branding } = await ui.load();
// ```
//
// No React, no Next.js, no `server-only`, no Node built-ins: this runs
// anywhere a `fetch`-shaped function does. React Server Component consumers
// want `najm-kit/server/react`, which memoizes one snapshot per request.
//
// Falling back is right for *public* appearance and branding, where the worst
// case is a visitor seeing the built-in logo. It is not a general rule. Do not
// route authenticated, financial, or privacy-sensitive reads through this: a
// silent fallback there hides an outage behind plausible-looking data.
// ============================================================================

/** Reaches the application's own backend. The path is resource-relative. */
export type UiBootstrapFetcher = (path: string) => Promise<Response>;

/** Why a resource fell back. Kept coarse enough to be worth alerting on. */
export type UiBootstrapFailureReason =
  | "fetch-failed"
  | "response-not-ok"
  | "invalid-json"
  | "invalid-envelope"
  | "invalid-payload";

/**
 * What the application learns about a fallback.
 *
 * Deliberately narrow. Response bodies, headers, cookies, and raw thrown
 * values never appear here — a branding endpoint answering with a stack trace
 * or a `Set-Cookie` must not become a log line. `error` is a normalized
 * summary, never the thrown value itself.
 */
export interface UiBootstrapDiagnostic {
  resource: string;
  reason: UiBootstrapFailureReason;
  path: string;
  /** Present for `response-not-ok`. */
  status?: number;
  /** Present when something was thrown; `"<name>: <message>"` for an `Error`. */
  error?: string;
}

export interface UiBootstrapResource<T> {
  /** Passed to the fetcher unchanged. */
  path: string;
  /**
   * Narrows the endpoint payload to the application's own type.
   *
   * Return `undefined` or throw to reject it — both are the same answer, so a
   * parser built from `undefined` guards and one built from a schema that
   * throws are equally usable without a wrapper.
   */
  parse: (input: unknown) => T | undefined;
  /**
   * The built-in value, used whenever the endpoint cannot produce a valid one.
   *
   * A function, not a value: it is called per load, so an application that
   * returns a fresh object keeps loads independent. Its failure is *not*
   * caught — a missing factory theme is a broken build, and a second fallback
   * would only hide it.
   */
  fallback: () => T;
  /** Per-resource envelope override. Defaults to the loader-level `select`. */
  select?: (payload: unknown) => unknown;
}

/**
 * Resources keyed by name.
 *
 * `any` rather than `unknown` in the value position: the payload types are
 * unrelated to each other, and `UiBootstrapResource<unknown>` is not a
 * supertype of `UiBootstrapResource<PublicBranding>` — `parse` and `fallback`
 * make `T` invariant, so every concrete configuration would fail the
 * constraint. Inference recovers the real type through `UiBootstrapValue`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UiBootstrapResources = Record<string, UiBootstrapResource<any>>;

export type UiBootstrapValue<R> = R extends UiBootstrapResource<infer T> ? T : never;

/** The resolved value of every configured resource, keyed by resource name. */
export type UiBootstrapSnapshot<R extends UiBootstrapResources> = {
  [K in keyof R]: UiBootstrapValue<R[K]>;
};

export interface UiBootstrapConfig<R extends UiBootstrapResources> {
  fetcher: UiBootstrapFetcher;
  resources: R;
  /**
   * Unwraps the endpoint response.
   *
   * Defaults to Najm's `{ data }` envelope. Applications behind a different
   * envelope — or none — pass their own; returning the payload unchanged is a
   * valid selector, and throwing rejects the response as `invalid-envelope`.
   */
  select?: (payload: unknown) => unknown;
  /**
   * Called once per fallback, never for a successful load.
   *
   * Optional because there is no sensible default: a package cannot know
   * whether this application wants `console.warn`, a counter, or a pager. Its
   * own failure is contained — an observability fault must not take the render
   * with it.
   */
  onDiagnostic?: (diagnostic: UiBootstrapDiagnostic) => void;
}

export interface UiBootstrapLoader<R extends UiBootstrapResources> {
  /** Every resource, loaded concurrently. */
  load(): Promise<UiBootstrapSnapshot<R>>;
  /** One resource on its own. */
  loadResource<K extends keyof R>(name: K): Promise<UiBootstrapSnapshot<R>[K]>;
  /** `loadResource` pre-bound per name, for destructuring into a facade. */
  loaders: { [K in keyof R]: () => Promise<UiBootstrapSnapshot<R>[K]> };
}

/** Distinct from `undefined`, which an endpoint may legitimately send. */
const MISSING = Symbol("najm-kit/server: missing envelope");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Najm's response envelope. */
function selectData(payload: unknown): unknown {
  return isRecord(payload) && "data" in payload ? payload.data : MISSING;
}

/**
 * Turns a thrown value into a string safe to log.
 *
 * Only `Error` contributes text. Anything else reports its type alone: a
 * rejected fetch can carry the whole response, and a thrown object stringified
 * into a diagnostic is how bodies and tokens reach log aggregators.
 */
function describeThrown(value: unknown): string {
  return value instanceof Error
    ? `${value.name}: ${value.message}`
    : `non-error thrown: ${typeof value}`;
}

export function createUiBootstrapLoader<R extends UiBootstrapResources>(
  config: UiBootstrapConfig<R>,
): UiBootstrapLoader<R> {
  const { fetcher, resources, onDiagnostic } = config;
  const selectEnvelope = config.select ?? selectData;
  const names = Object.keys(resources) as (keyof R & string)[];

  const report = (diagnostic: UiBootstrapDiagnostic) => {
    if (!onDiagnostic) return;
    try {
      onDiagnostic(diagnostic);
    } catch {
      // A broken reporter is not a reason to serve a broken page.
    }
  };

  async function loadOne<K extends keyof R & string>(
    name: K,
  ): Promise<UiBootstrapSnapshot<R>[K]> {
    type Value = UiBootstrapSnapshot<R>[K];
    const resource = resources[name] as UiBootstrapResource<Value>;
    const { path } = resource;
    const select = resource.select ?? selectEnvelope;

    const fail = (
      reason: UiBootstrapFailureReason,
      detail: { status?: number; error?: string } = {},
    ): Value => {
      report({ resource: name, reason, path, ...detail });
      // Outside every `try` on purpose: a factory value that cannot be built
      // is the application's configuration error, and a second fallback would
      // turn it into a blank page with no explanation.
      return resource.fallback();
    };

    let response: Response;
    try {
      response = await fetcher(path);
    } catch (cause) {
      return fail("fetch-failed", { error: describeThrown(cause) });
    }

    if (!response.ok) return fail("response-not-ok", { status: response.status });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (cause) {
      return fail("invalid-json", { error: describeThrown(cause) });
    }

    let data: unknown;
    try {
      data = select(payload);
    } catch (cause) {
      return fail("invalid-envelope", { error: describeThrown(cause) });
    }
    if (data === MISSING) return fail("invalid-envelope");

    try {
      const parsed = resource.parse(data);
      if (parsed !== undefined) return parsed;
    } catch (cause) {
      return fail("invalid-payload", { error: describeThrown(cause) });
    }
    return fail("invalid-payload");
  }

  const loaders = Object.fromEntries(
    names.map((name) => [name, () => loadOne(name)]),
  ) as UiBootstrapLoader<R>["loaders"];

  async function load(): Promise<UiBootstrapSnapshot<R>> {
    // Started before the first await, so the resources overlap. Awaiting them
    // one at a time would add every endpoint's latency to the render.
    const pending = names.map((name) => loadOne(name));
    const settled = await Promise.all(pending);

    const snapshot = {} as UiBootstrapSnapshot<R>;
    names.forEach((name, index) => {
      snapshot[name] = settled[index] as UiBootstrapSnapshot<R>[typeof name];
    });

    // The container only. Freezing the values would mutate objects the
    // application owns and may reuse — including a shared factory constant.
    Object.freeze(snapshot);
    return snapshot;
  }

  return { load, loadResource: (name) => loaders[name](), loaders };
}
