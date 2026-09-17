/**
 * `najm-next/app/server` — typed Next.js server bootstrap.
 *
 * Leaf server entry: composes the existing Auth/Theme/Kit owners through
 * structural callbacks. It never imports `najm-auth`, `najm-kit`,
 * `najm-theme`, Kafil/School backends, the filesystem, `process.env`, or the
 * current working directory. Backend binding stays lazy and explicit in the
 * application (its `readSettings`, `theme.getServer`, and cookie/header
 * readers); this module only orchestrates concurrency, request-scoped
 * memoization, sanitized diagnostics, and a serializable public snapshot.
 *
 * Refinement note on the frozen ledger sketch (§4.3): the ledger declares
 * `createNajmServerApp<TSettings, TSnapshot>` with `resolvePreferences`
 * returning an opaque `TSnapshot`. An opaque snapshot cannot guarantee the
 * "typed, public, serializable" contract (no app definition, callbacks, auth
 * object, raw env, server object, QueryClient, secrets, or unprojected
 * settings). This keeps every ledger name/ownership (`createNajmServerApp`,
 * `readSettings`, `resolvePreferences`, `onDiagnostic`, `loadSettings`,
 * `loadUiSnapshot`, `getSession`, `requireSession`, `requireRole`) and refines
 * the generics to `TSettings, TPreferences, TAppearance, TBranding` with an
 * explicit `NajmServerUiSnapshot` shape `{ app, session, preferences,
 * appearance, branding, settings }`, so the serializable boundary is typed
 * rather than conventional.
 *
 * React Server Components only. Route handlers, server actions, and scripts
 * keep using the underlying owners directly — outside a render there is no
 * request cache for `cache()` to write to.
 *
 * Consumers keep `import "server-only"` in their own server modules (as
 * Kafil/School already do). This entry stays dependency-free apart from the
 * declared `react` peer and the pure `../app` definition, so config-only
 * consumers never pay for it.
 */

import * as React from "react";

import { assertNajmAppDefinition, type NajmAppDefinition } from "../app";

if (typeof window !== "undefined") {
  throw new Error(
    "najm-next/app/server is a React Server Component module. It cannot be imported "
      + "from a Client Component or any browser bundle. Seed the client from the server "
      + "snapshot instead.",
  );
}

/**
 * Public session projection. Structurally compatible with `ServerSession`
 * from `najm-auth/client/server` without importing it.
 */
export interface NajmServerSession {
  readonly user: unknown;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}

/** Allowlisted application display values safe to cross the RSC boundary. */
export interface NajmPublicAppDisplay {
  readonly appName?: string;
  readonly currency?: string;
}

/**
 * Structural form of the React-server auth accessor
 * (`createReactServerAuth(auth)`). Session error classification stays owned
 * by Najm Auth: verified no-session/expired/invalid states resolve to `null`
 * via `getSession`, while configuration, transport, backend, and unexpected
 * failures propagate — no blanket catch, no universal anonymous fallback.
 */
export interface NajmServerAuth<TSession extends NajmServerSession = NajmServerSession> {
  getSession(): Promise<TSession | null>;
  requireSession(): Promise<TSession>;
  requireRole(roles: readonly string[]): Promise<TSession>;
}

/** Structural form of the theme bootstrap (`theme.react({...})`). */
export interface NajmServerTheme<TAppearance, TBranding> {
  loadAppearance(): Promise<TAppearance>;
  loadBranding(): Promise<TBranding>;
}

/** Structural cookie reader (for example Next's cookie store). */
export interface NajmServerCookieReader {
  get(name: string): { value: string } | undefined;
}

/** Structural header reader (for example Next's `headers()`). */
export interface NajmServerHeaderReader {
  get(name: string): string | null;
}

/**
 * Reads the application's public settings projection.
 *
 * Returns only the typed public projection (Kafil `{ enabled: boolean }`,
 * School its existing UI settings projection). Never the raw settings row,
 * env, cookies, session, or secrets.
 */
export interface NajmPublicSettingsReader<TSettings> {
  (): Promise<TSettings>;
}

/** Input to the application's preference selection. */
export interface NajmResolvePreferencesInput<TSettings, TSession extends NajmServerSession = NajmServerSession> {
  readonly cookies: NajmServerCookieReader;
  readonly headers: NajmServerHeaderReader;
  readonly session: TSession | null;
  readonly settings: TSettings;
}

/**
 * Selects the public UI preferences from already-resolved inputs.
 *
 * Implemented by the application on top of `najm-kit/server` ordered
 * resolution — never a duplicate resolver. May be sync or async.
 */
export type NajmResolvePreferences<TSettings, TPreferences, TSession extends NajmServerSession = NajmServerSession> = (
  input: NajmResolvePreferencesInput<TSettings, TSession>,
) => TPreferences | Promise<TPreferences>;

/**
 * Sanitized diagnostic. `code` is stable; `detail` contains only `"error"`
 * or `"non-error thrown: <type>"` — never an exception name/message, raw
 * thrown value, settings, env, cookies, session, or secret.
 */
export interface NajmServerDiagnostic {
  readonly code: string;
  readonly detail?: string;
}

/**
 * The typed, public, serializable initial UI snapshot.
 *
 * Only these allowlisted fields. `app` contains display defaults only, never
 * the complete definition, callbacks, auth object, raw env, server object,
 * QueryClient, secrets, or unprojected settings.
 */
export interface NajmServerUiSnapshot<TSettings, TPreferences, TAppearance, TBranding, TSession extends NajmServerSession = NajmServerSession> {
  readonly app: NajmPublicAppDisplay;
  readonly session: TSession | null;
  readonly preferences: TPreferences;
  readonly appearance: TAppearance;
  readonly branding: TBranding;
  readonly settings: TSettings;
}

export interface NajmServerApp<TSettings, TPreferences, TAppearance, TBranding, TSession extends NajmServerSession = NajmServerSession> {
  /** Lightweight: delegates to auth, triggers nothing else. */
  readonly getSession: () => Promise<TSession | null>;
  /** Lightweight: delegates to auth, triggers nothing else. */
  readonly requireSession: () => Promise<TSession>;
  /** Lightweight: delegates to auth, triggers nothing else. */
  readonly requireRole: (roles: readonly string[]) => Promise<TSession>;
  /** Public settings projection, memoized per React request. */
  readonly loadSettings: () => Promise<TSettings>;
  /** Full public snapshot, memoized per React request. */
  readonly loadUiSnapshot: () => Promise<
    NajmServerUiSnapshot<TSettings, TPreferences, TAppearance, TBranding, TSession>
  >;
}

export interface CreateNajmServerAppOptions<TSettings, TPreferences, TAppearance, TBranding, TSession extends NajmServerSession = NajmServerSession> {
  readonly app: NajmAppDefinition;
  readonly auth: NajmServerAuth<TSession>;
  readonly theme: NajmServerTheme<TAppearance, TBranding>;
  readonly readSettings: NajmPublicSettingsReader<TSettings>;
  /**
   * Typed public fallback used when `readSettings` throws. Display reads
   * only — never for protected, financial, or account data.
   */
  readonly fallbackSettings: TSettings;
  readonly resolvePreferences: NajmResolvePreferences<TSettings, TPreferences, TSession>;
  /** Lazily reads the request cookies (for example `() => cookies()`). */
  readonly readCookies: () => Promise<NajmServerCookieReader>;
  /** Lazily reads the request headers (for example `() => headers()`). */
  readonly readHeaders: () => Promise<NajmServerHeaderReader>;
  readonly onDiagnostic?: (diagnostic: NajmServerDiagnostic) => void;
}

type CacheFn = <T extends (...args: never[]) => unknown>(fn: T) => T;

function toSafeDetail(value: unknown): string {
  if (value instanceof Error) {
    return "error";
  }
  return `non-error thrown: ${typeof value}`;
}

/**
 * Create one application's server bootstrap. Call once at module scope —
 * never per layout render — so every caller in a request shares the same
 * memoization entries.
 */
export function createNajmServerApp<TSettings, TPreferences, TAppearance, TBranding, TSession extends NajmServerSession = NajmServerSession>(
  options: CreateNajmServerAppOptions<TSettings, TPreferences, TAppearance, TBranding, TSession>,
): NajmServerApp<TSettings, TPreferences, TAppearance, TBranding, TSession> {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("najm-next/app/server: options must be an object");
  }
  assertNajmAppDefinition(options.app);
  const { auth, theme, readSettings, fallbackSettings, resolvePreferences, readCookies, readHeaders } =
    options;
  if (typeof auth !== "object" || auth === null) {
    throw new TypeError("najm-next/app/server: auth must be an object");
  }
  if (typeof auth.getSession !== "function") {
    throw new TypeError("najm-next/app/server: auth.getSession must be a function");
  }
  if (typeof auth.requireSession !== "function") {
    throw new TypeError("najm-next/app/server: auth.requireSession must be a function");
  }
  if (typeof auth.requireRole !== "function") {
    throw new TypeError("najm-next/app/server: auth.requireRole must be a function");
  }
  if (typeof theme !== "object" || theme === null) {
    throw new TypeError("najm-next/app/server: theme must be an object");
  }
  if (typeof theme.loadAppearance !== "function") {
    throw new TypeError("najm-next/app/server: theme.loadAppearance must be a function");
  }
  if (typeof theme.loadBranding !== "function") {
    throw new TypeError("najm-next/app/server: theme.loadBranding must be a function");
  }
  if (typeof readSettings !== "function") {
    throw new TypeError("najm-next/app/server: readSettings must be a function");
  }
  if (typeof resolvePreferences !== "function") {
    throw new TypeError("najm-next/app/server: resolvePreferences must be a function");
  }
  if (typeof readCookies !== "function") {
    throw new TypeError("najm-next/app/server: readCookies must be a function");
  }
  if (typeof readHeaders !== "function") {
    throw new TypeError("najm-next/app/server: readHeaders must be a function");
  }
  if (options.onDiagnostic !== undefined && typeof options.onDiagnostic !== "function") {
    throw new TypeError("najm-next/app/server: onDiagnostic must be a function");
  }

  const cache = (React as { cache?: CacheFn }).cache;
  if (typeof cache !== "function") {
    throw new Error(
      "najm-next/app/server requires a React version that exports cache() "
        + "(React 18.3 or newer). Upgrade react.",
    );
  }

  const onDiagnostic = options.onDiagnostic;
  const app = Object.freeze({
    ...(options.app.appName === undefined ? {} : { appName: options.app.appName }),
    ...(options.app.currency === undefined ? {} : { currency: options.app.currency }),
  });

  const report = (code: string, cause?: unknown) => {
    if (!onDiagnostic) return;
    try {
      onDiagnostic(
        cause === undefined
          ? { code }
          : { code, detail: toSafeDetail(cause) },
      );
    } catch {
      // A broken reporter must not break the render.
    }
  };

  async function loadSettingsUncached(): Promise<TSettings> {
    try {
      return await readSettings();
    } catch (cause) {
      // Display fallback only. The fallback value is the application's typed
      // projection (for example `{ enabled: false }`); the raw failure never
      // leaves this module; diagnostics identify only that an Error occurred.
      report("settings-unavailable", cause);
      return fallbackSettings;
    }
  }

  const loadSettings = cache(loadSettingsUncached);

  async function loadUiSnapshotUncached(): Promise<
    NajmServerUiSnapshot<TSettings, TPreferences, TAppearance, TBranding, TSession>
  > {
    // Started before the first await so session, cookies/headers, theme, and
    // settings overlap. Preference selection waits only for its own inputs
    // below — never for appearance/branding.
    const sessionP = auth.getSession();
    const cookiesP = readCookies();
    const headersP = readHeaders();
    const appearanceP = theme.loadAppearance();
    const brandingP = theme.loadBranding();
    const settingsP = loadSettings();

    const [session, cookies, headers, settings] = await Promise.all([
      sessionP,
      cookiesP,
      headersP,
      settingsP,
    ]);
    const preferencesP = resolvePreferences({ cookies, headers, session, settings });
    const [appearance, branding, preferences] = await Promise.all([
      appearanceP,
      brandingP,
      preferencesP,
    ]);

    // The container only. Freezing values would mutate objects the
    // application owns and may reuse.
    return Object.freeze({ app, session, preferences, appearance, branding, settings });
  }

  const loadUiSnapshot = cache(loadUiSnapshotUncached);

  // Lightweight by construction: direct delegation, no theme/settings/cookie/
  // header reads. Each is its own function (not cached here) so a nested
  // layout can call session accessors without paying for unrelated loads;
  // request-scoping comes from the underlying auth accessor.
  const getSession = () => auth.getSession();
  const requireSession = () => auth.requireSession();
  const requireRole = (roles: readonly string[]) => auth.requireRole(roles);

  return { getSession, requireSession, requireRole, loadSettings, loadUiSnapshot };
}
