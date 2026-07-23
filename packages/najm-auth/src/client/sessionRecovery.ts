import {
  verifySessionCookie,
  type SessionCookieClaims,
} from './sessionCookie';

export interface SessionRecoveryOptions {
  endpoint: string;
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
  if (!isSafeRecoveryEndpoint(options.endpoint)) {
    return { status: 'unavailable' };
  }

  let response: Response;
  try {
    response = await fetch(options.endpoint, {
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
  return value.length > 0 && !/[\r\n;]/.test(value);
}

function isSafeRecoveryEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname === '[::1]'
      || url.hostname === '::1';
  } catch {
    return false;
  }
}
