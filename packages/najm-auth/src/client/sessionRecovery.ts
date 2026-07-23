import {
  verifySessionCookie,
  type SessionCookieClaims,
} from './sessionCookie';

export interface SessionRecoveryOptions {
  /** Fully resolved or relative recovery endpoint. */
  endpoint: string;
  /** Origin of the incoming request that supplied the refresh cookie. */
  requestOrigin: string;
  refreshCookieName: string;
  refreshCookieValue: string;
  sessionCookieName: string;
  sessionSecret: string;
  sessionMaxAge?: number;
}

export type SessionRecoveryResult =
  | {
      status: 'recovered';
      claims: SessionCookieClaims;
      setCookie: string;
      sessionCookieValue: string;
    }
  | {
      status: 'invalid' | 'unavailable';
      httpStatus?: number;
    };

/**
 * Ask the auth server to validate a refresh session and reissue only the
 * short-lived signed session cookie. The refresh token is neither rotated nor
 * returned, and the response is accepted only after local HMAC verification.
 */
export async function requestSessionRecovery(
  options: SessionRecoveryOptions,
): Promise<SessionRecoveryResult> {
  if (!isCookieName(options.refreshCookieName) || !isCookieName(options.sessionCookieName)) {
    return { status: 'unavailable' };
  }
  if (!isCookieValue(options.refreshCookieValue)) {
    return { status: 'invalid' };
  }
  const endpoint = sameOriginRecoveryEndpoint(
    options.endpoint,
    options.requestOrigin,
  );
  if (!endpoint) {
    return { status: 'unavailable' };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Cookie: `${options.refreshCookieName}=${options.refreshCookieValue}`,
        'X-Najm-Session-Recovery': '1',
      },
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return { status: 'unavailable' };
  }

  if (!response.ok) {
    const status = response.status;
    return {
      status: status === 400 || status === 401 || status === 403
        ? 'invalid'
        : 'unavailable',
      httpStatus: status,
    };
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return { status: 'unavailable', httpStatus: response.status };

  const sessionCookieValue = readSetCookieValue(setCookie, options.sessionCookieName);
  if (!sessionCookieValue) {
    return { status: 'unavailable', httpStatus: response.status };
  }

  const claims = await verifySessionCookie(sessionCookieValue, {
    secret: options.sessionSecret,
    maxAgeSeconds: options.sessionMaxAge,
  });
  if (!claims) return { status: 'unavailable', httpStatus: response.status };

  return {
    status: 'recovered',
    claims,
    setCookie,
    sessionCookieValue,
  };
}

export function authEndpoint(
  baseURL: string,
  authPrefix: string,
  suffix: string,
  requestURL?: string,
): string {
  const normalizedBase = baseURL.replace(/\/+$/, '');
  const normalizedPrefix = `/${authPrefix.replace(/^\/+|\/+$/g, '')}`;
  const normalizedSuffix = `/${suffix.replace(/^\/+/, '')}`;
  const value = `${normalizedBase}${normalizedPrefix}${normalizedSuffix}`;
  return requestURL ? new URL(value, requestURL).toString() : value;
}

export function replaceCookieValue(
  cookieHeader: string,
  name: string,
  value: string,
): string {
  const parts = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.slice(0, part.indexOf('=')).trim() !== name);
  parts.push(`${name}=${value}`);
  return parts.join('; ');
}

function readSetCookieValue(setCookie: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = setCookie.match(new RegExp(`(?:^|,\\s*)${escaped}=([^;]*)`));
  return match?.[1] || undefined;
}

function isCookieName(value: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value);
}

function isCookieValue(value: string): boolean {
  // RFC 6265 cookie-octet: reject whitespace, controls, quotes, commas,
  // semicolons, and backslashes before constructing the outbound header.
  return value.length > 0
    && /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(value);
}

function sameOriginRecoveryEndpoint(
  endpoint: string,
  requestOrigin: string,
): string | undefined {
  try {
    const trusted = new URL(requestOrigin);
    if (
      (trusted.protocol !== 'https:' && trusted.protocol !== 'http:')
      || trusted.username
      || trusted.password
    ) {
      return undefined;
    }

    const resolved = new URL(endpoint, trusted.origin);
    if (resolved.username || resolved.password) return undefined;
    if (resolved.origin !== trusted.origin) return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}
