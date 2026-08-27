// ============================================================================
// authCookiePersistence — "remember me" for the auth cookies
// ============================================================================
//
// The auth endpoints issue the same cookies regardless of whether the user
// asked to be remembered, because the decision is a UI one and the token
// lifetime is not. This wraps the handler and rewrites the outgoing cookies to
// match the choice:
//
//   remembered      → the cookies keep their Max-Age and survive a browser restart
//   not remembered  → the same cookies become session cookies and do not
//
// The choice itself has to be stored somewhere, because a refresh request does
// not carry it: only the original login body does. That is the `remember`
// cookie below — HttpOnly, holding one bit.
// ============================================================================

type RequestHandler = (request: Request) => Promise<Response>;

type AuthCookieMode = 'persistent' | 'session';

type AuthCookieAction =
  | { type: 'apply'; mode: AuthCookieMode }
  | { type: 'clear' }
  | { type: 'setup' }
  | null;

export interface AuthCookiePersistenceOptions {
  /**
   * Cookies whose lifetime this rewrites. Defaults to the two najm-auth issues.
   * Anything not named here is passed through untouched.
   */
  authCookieNames?: string[];
  /** Where the one-bit choice is stored. Defaults to `najm.remember`. */
  rememberCookieName?: string;
  /** How long a remembered choice lasts. Defaults to 7 days. */
  maxAgeSeconds?: number;
  /** Paths whose JSON body carries `rememberMe`. Defaults to `/api/auth/login`. */
  loginPaths?: string[];
  /** Paths that end a session and clear the choice. Defaults to `/api/auth/logout`. */
  logoutPaths?: string[];
  /** Paths that reissue cookies and must reapply the stored choice. */
  refreshPaths?: string[];
  /**
   * Paths that finish credential setup. The stored choice is cleared there:
   * the login it was recorded for never produced a session.
   */
  setupCompletionPaths?: string[];
  /**
   * Recognizes a response that has *not* issued a usable session because the
   * user must still set up credentials.
   *
   * Najm's own setup response is recognized without this — supply it only to
   * cover an application-specific shape. Such a response may carry auth
   * cookies anyway, and persisting them would leave a half-authenticated
   * browser that skips the setup step on reload. Returning `true` replaces
   * them with deletions and clears the stored choice.
   */
  isSetupResponse?: (payload: unknown) => boolean;
}

const DEFAULTS = {
  authCookieNames: ['refreshToken', 'najm.session'],
  rememberCookieName: 'najm.remember',
  maxAgeSeconds: 7 * 24 * 60 * 60,
  loginPaths: ['/api/auth/login'],
  logoutPaths: ['/api/auth/logout'],
  refreshPaths: ['/api/auth/refresh', '/api/auth/session/recover'],
  setupCompletionPaths: ['/api/auth/credential-setup/change'],
};

/**
 * Najm answers a pending setup either at the top level or inside the standard
 * `{ data }` envelope, depending on how the route is wrapped.
 */
function isNajmSetupResponse(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const body = payload as { nextStep?: unknown; data?: unknown };
  if (body.nextStep === 'credential_setup') return true;
  const data = body.data;
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { nextStep?: unknown }).nextStep === 'credential_setup'
  );
}

function cookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

function cookieName(setCookie: string): string {
  const separator = setCookie.indexOf('=');
  return separator < 0 ? '' : setCookie.slice(0, separator).trim();
}

/**
 * Strips the lifetime attributes so the browser drops the cookie when it closes.
 *
 * Only the named auth cookies are touched — rewriting an unrelated `Set-Cookie`
 * from the same response would be a silent side effect on someone else's state.
 */
export function makeSessionCookie(
  setCookie: string,
  authCookieNames: string[] = DEFAULTS.authCookieNames,
): string {
  if (!authCookieNames.includes(cookieName(setCookie))) return setCookie;

  return setCookie
    .split(';')
    .filter((part) => !/^\s*(?:expires|max-age)=/i.test(part))
    .join(';');
}

/** True when a `Set-Cookie` is a deletion rather than an issuance. */
function isDeletionCookie(setCookie: string): boolean {
  if (/^[^=]+=\s*(?:;|$)/.test(setCookie)) return true;
  if (/(?:^|;)\s*max-age=0(?:;|$)/i.test(setCookie)) return true;

  const expires = /(?:^|;)\s*expires=([^;]+)/i.exec(setCookie)?.[1];
  return expires ? new Date(expires).getTime() <= Date.now() : false;
}

function rememberCookie(
  name: string,
  mode: AuthCookieMode,
  secure: boolean,
  maxAgeSeconds: number,
): string {
  const attributes = [
    `${name}=${mode === 'persistent' ? '1' : '0'}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (secure) attributes.push('Secure');
  // A session-mode preference is itself a session cookie: remembering "do not
  // remember me" past the browser closing would outlive the thing it describes.
  if (mode === 'persistent') attributes.push(`Max-Age=${maxAgeSeconds}`);

  return attributes.join('; ');
}

function clearedRememberCookie(name: string, secure: boolean): string {
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    'Max-Age=0',
  ].join('; ');
}

function clearedAuthCookie(name: string, secure: boolean): string {
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ].join('; ');
}

/**
 * Wraps a request handler so the auth cookies it issues match the user's
 * "remember me" choice.
 *
 * ```ts
 * // app/api/[...route]/route.ts
 * const handler = withAuthCookiePersistence((req) => server.fetch(req));
 * export { handler as GET, handler as POST };
 * ```
 */
export function withAuthCookiePersistence(
  handler: RequestHandler,
  options: AuthCookiePersistenceOptions = {},
): RequestHandler {
  const {
    authCookieNames = DEFAULTS.authCookieNames,
    rememberCookieName = DEFAULTS.rememberCookieName,
    maxAgeSeconds = DEFAULTS.maxAgeSeconds,
    loginPaths = DEFAULTS.loginPaths,
    logoutPaths = DEFAULTS.logoutPaths,
    refreshPaths = DEFAULTS.refreshPaths,
    setupCompletionPaths = DEFAULTS.setupCompletionPaths,
    isSetupResponse,
  } = options;

  const resolveAction = async (request: Request): Promise<AuthCookieAction> => {
    const { pathname } = new URL(request.url);

    if (loginPaths.includes(pathname)) {
      // Cloned so the wrapped handler still receives an unread body.
      const body = (await request
        .clone()
        .json()
        .catch(() => null)) as { rememberMe?: unknown } | null;
      return {
        type: 'apply',
        mode: body?.rememberMe === true ? 'persistent' : 'session',
      };
    }

    if (logoutPaths.includes(pathname)) return { type: 'clear' };

    // Setup completed: the preference recorded at the login that started it
    // described a session that was never issued.
    if (setupCompletionPaths.includes(pathname)) return { type: 'clear' };

    if (refreshPaths.includes(pathname)) {
      const remembered = cookieValue(
        request.headers.get('cookie') ?? '',
        rememberCookieName,
      );
      if (remembered === '0') return { type: 'apply', mode: 'session' };
      if (remembered === '1') return { type: 'apply', mode: 'persistent' };
    }

    return null;
  };

  const applyAction = (
    response: Response,
    action: Exclude<AuthCookieAction, null>,
    secure: boolean,
  ): Response => {
    const headers = new Headers(response.headers);
    const setCookies = (
      headers as Headers & { getSetCookie(): string[] }
    ).getSetCookie();
    headers.delete('set-cookie');
    const clearedAuthCookies = new Set<string>();

    for (const setCookie of setCookies) {
      const name = cookieName(setCookie);
      const isAuthCookie = authCookieNames.includes(name);

      // Successful logout and setup completion are terminal auth boundaries.
      // Preserve one valid upstream deletion because it may carry a custom
      // cookie path, but never pass through a stale issuance or duplicate.
      if (
        (action.type === 'clear' || action.type === 'setup') &&
        isAuthCookie
      ) {
        if (isDeletionCookie(setCookie) && !clearedAuthCookies.has(name)) {
          headers.append('set-cookie', setCookie);
          clearedAuthCookies.add(name);
        }
        continue;
      }

      headers.append(
        'set-cookie',
        action.type === 'apply' && action.mode === 'session'
          ? makeSessionCookie(setCookie, authCookieNames)
          : setCookie,
      );
    }

    if (action.type === 'clear' || action.type === 'setup') {
      for (const name of authCookieNames) {
        if (!clearedAuthCookies.has(name)) {
          headers.append('set-cookie', clearedAuthCookie(name, secure));
        }
      }
    }

    headers.append(
      'set-cookie',
      action.type === 'clear' || action.type === 'setup'
        ? clearedRememberCookie(rememberCookieName, secure)
        : rememberCookie(rememberCookieName, action.mode, secure, maxAgeSeconds),
    );

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };

  return async (request) => {
    let action = await resolveAction(request);
    const response = await handler(request);

    // A failed login issues nothing worth rewriting, and storing a preference
    // for it would apply on the next refresh of a session that was never made.
    if (!response.ok) return response;

    // Only a login can answer "setup pending", so only a login pays for
    // reading the body back.
    if (action?.type === 'apply' && loginPaths.includes(new URL(request.url).pathname)) {
      const payload = await response
        .clone()
        .json()
        .catch(() => null);
      if (isNajmSetupResponse(payload) || isSetupResponse?.(payload)) {
        action = { type: 'setup' };
      }
    }

    if (!action) return response;

    return applyAction(
      response,
      action,
      new URL(request.url).protocol === 'https:',
    );
  };
}
