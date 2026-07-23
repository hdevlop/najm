import {
  verifySessionCookieDetailed,
  type SessionCookieClaims,
} from './sessionCookie';

export type SessionRecoveryFailureReason =
  | 'invalid-cookie-name'
  | 'invalid-refresh-cookie'
  | 'invalid-endpoint'
  | 'fetch-error'
  | 'http-status'
  | 'missing-set-cookie'
  | 'session-cookie-parse'
  | 'session-cookie-hmac'
  | 'session-cookie-payload';

export interface SessionRecoveryErrorDetails {
  name: string;
  message: string;
  code?: string;
  cause?: {
    name: string;
    message: string;
    code?: string;
  };
}

export interface SessionRecoveryFailure {
  reason: SessionRecoveryFailureReason;
  httpStatus?: number;
  error?: SessionRecoveryErrorDetails;
}

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
  /** Allow an explicitly configured HTTP(S) loopback endpoint. */
  allowLoopbackEndpoint?: boolean;
  /**
   * Receives structured, secret-free recovery failures. The hook is silent by
   * default and exceptions thrown by it never affect authentication behavior.
   */
  onFailure?: (failure: SessionRecoveryFailure) => void;
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

/** Resolve the optional loopback transport URL without importing Node APIs. */
export function resolveInternalRecoveryURL(explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit || undefined;
  if (typeof process === 'undefined') return undefined;
  return process.env.NAJM_AUTH_INTERNAL_URL || undefined;
}

/**
 * Ask the auth server to validate a refresh session and reissue only the
 * short-lived signed session cookie. The refresh token is neither rotated nor
 * returned, and the response is accepted only after local HMAC verification.
 */
export async function requestSessionRecovery(
  options: SessionRecoveryOptions,
): Promise<SessionRecoveryResult> {
  if (!isCookieName(options.refreshCookieName) || !isCookieName(options.sessionCookieName)) {
    reportFailure(options, { reason: 'invalid-cookie-name' });
    return { status: 'unavailable' };
  }
  if (!isCookieValue(options.refreshCookieValue)) {
    reportFailure(options, { reason: 'invalid-refresh-cookie' });
    return { status: 'invalid' };
  }
  const endpoint = sameOriginRecoveryEndpoint(
    options.endpoint,
    options.requestOrigin,
    options.allowLoopbackEndpoint,
  );
  if (!endpoint) {
    reportFailure(options, { reason: 'invalid-endpoint' });
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
  } catch (error) {
    reportFailure(options, {
      reason: 'fetch-error',
      error: safeErrorDetails(error, [
        options.refreshCookieValue,
        options.sessionSecret,
        endpoint,
        options.requestOrigin,
      ]),
    });
    return { status: 'unavailable' };
  }

  if (!response.ok) {
    const status = response.status;
    reportFailure(options, { reason: 'http-status', httpStatus: status });
    return {
      status: status === 400 || status === 401 || status === 403
        ? 'invalid'
        : 'unavailable',
      httpStatus: status,
    };
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    reportFailure(options, {
      reason: 'missing-set-cookie',
      httpStatus: response.status,
    });
    return { status: 'unavailable', httpStatus: response.status };
  }

  const sessionCookieValue = readSetCookieValue(setCookie, options.sessionCookieName);
  if (!sessionCookieValue) {
    reportFailure(options, {
      reason: 'session-cookie-parse',
      httpStatus: response.status,
    });
    return { status: 'unavailable', httpStatus: response.status };
  }

  const verification = await verifySessionCookieDetailed(sessionCookieValue, {
    secret: options.sessionSecret,
    maxAgeSeconds: options.sessionMaxAge,
  });
  if (verification.status === 'invalid') {
    reportFailure(options, {
      reason: verification.reason === 'hmac'
        ? 'session-cookie-hmac'
        : verification.reason === 'payload'
          ? 'session-cookie-payload'
          : 'session-cookie-parse',
      httpStatus: response.status,
    });
    return { status: 'unavailable', httpStatus: response.status };
  }

  return {
    status: 'recovered',
    claims: verification.claims,
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
  allowLoopback = false,
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
    if (
      resolved.origin !== trusted.origin
      && (!allowLoopback || !isLoopbackURL(resolved))
    ) {
      return undefined;
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
}

function isLoopbackURL(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]'
    || url.hostname === '::1';
}

function reportFailure(
  options: SessionRecoveryOptions,
  failure: SessionRecoveryFailure,
): void {
  try {
    options.onFailure?.(failure);
  } catch {
    // Diagnostics must never alter authentication behavior.
  }
}

function safeErrorDetails(
  value: unknown,
  sensitiveValues: string[],
): SessionRecoveryErrorDetails {
  const error = isRecord(value) ? value : {};
  const details: SessionRecoveryErrorDetails = {
    name: safeText(error.name, 'Error', sensitiveValues),
    message: safeText(error.message, 'Session recovery fetch failed', sensitiveValues),
  };
  const code = safeOptionalText(error.code, sensitiveValues);
  if (code) details.code = code;

  if (isRecord(error.cause)) {
    const causeCode = safeOptionalText(error.cause.code, sensitiveValues);
    details.cause = {
      name: safeText(error.cause.name, 'Error', sensitiveValues),
      message: safeText(error.cause.message, 'Session recovery fetch failed', sensitiveValues),
      ...(causeCode ? { code: causeCode } : {}),
    };
  }
  return details;
}

function safeText(
  value: unknown,
  fallback: string,
  sensitiveValues: string[],
): string {
  if (typeof value !== 'string' || !value) return fallback;
  let safe = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\b(authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]');
  for (const sensitive of sensitiveValues) {
    if (sensitive) safe = safe.split(sensitive).join('[redacted]');
  }
  return safe.slice(0, 300);
}

function safeOptionalText(
  value: unknown,
  sensitiveValues: string[],
): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return safeText(String(value), '', sensitiveValues);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
