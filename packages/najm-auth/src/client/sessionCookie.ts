import type { AuthUser } from './types';

export interface SessionCookieClaims {
  user: AuthUser;
  roles: string[];
  permissions: string[];
  sessionVersion: number;
  /** Epoch milliseconds when the session cookie was issued. */
  iat: number;
}

export interface VerifySessionCookieOptions {
  secret: string;
  /** Must match the auth plugin's session.maxAge. Default: 300 seconds. */
  maxAgeSeconds?: number;
  /** Test hook for deterministic expiration checks. */
  now?: number;
}

export type SessionCookieVerificationFailure =
  | 'format'
  | 'hmac'
  | 'payload';

export type SessionCookieVerificationResult =
  | {
      status: 'valid';
      claims: SessionCookieClaims;
    }
  | {
      status: 'invalid';
      reason: SessionCookieVerificationFailure;
    };

const DEFAULT_SESSION_MAX_AGE_SECONDS = 300;
const MAX_CLOCK_SKEW_MS = 30_000;
const HMAC_SHA256_BASE64URL_LENGTH = 43;
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Resolve the session HMAC secret without importing Node runtime modules.
 *
 * Next.js replaces statically referenced environment variables in middleware
 * bundles. The explicit option remains the preferred choice for runtimes that
 * do not expose `process.env`.
 */
export function resolveSessionSecret(explicit?: string): string | undefined {
  if (explicit !== undefined) return explicit || undefined;
  if (typeof process === 'undefined') return undefined;
  return process.env.NAJM_SESSION_SECRET || process.env.JWT_ACCESS_SECRET || undefined;
}

/**
 * Parse and validate an already signature-verified session payload.
 *
 * This is also used by the server-side CookieManager so the backend, server
 * components, and Edge middleware enforce identical claim and expiry rules.
 */
export function parseSessionCookiePayload(
  payload: string,
  maxAgeSeconds = DEFAULT_SESSION_MAX_AGE_SECONDS,
  now = Date.now(),
): SessionCookieClaims | null {
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) return null;

  try {
    const data: unknown = JSON.parse(payload);
    if (!isRecord(data) || !isValidUser(data.user)) return null;
    if (!isStringArray(data.roles) || !isStringArray(data.permissions)) return null;
    if (!Number.isInteger(data.sessionVersion) || (data.sessionVersion as number) < 0) return null;
    if (!Number.isFinite(data.iat) || !Number.isInteger(data.iat) || (data.iat as number) <= 0) return null;

    const issuedAt = data.iat as number;
    if (issuedAt > now + MAX_CLOCK_SKEW_MS) return null;
    if (now - issuedAt >= maxAgeSeconds * 1000) return null;

    return {
      user: data.user as AuthUser,
      roles: [...data.roles],
      permissions: [...data.permissions],
      sessionVersion: data.sessionVersion as number,
      iat: issuedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Verify and decode a `najm.session` cookie using Web Crypto.
 *
 * The cookie format is `<JSON payload>.<base64url HMAC-SHA256>`, matching
 * `CookieService.setSigned()`. No refresh or network request is performed.
 */
export async function verifySessionCookie(
  rawCookieValue: string,
  options: VerifySessionCookieOptions,
): Promise<SessionCookieClaims | null> {
  const result = await verifySessionCookieDetailed(rawCookieValue, options);
  return result.status === 'valid' ? result.claims : null;
}

/**
 * Verify a signed session while retaining a safe failure category for server
 * diagnostics. The result never contains the cookie value, payload, signature,
 * or secret.
 */
export async function verifySessionCookieDetailed(
  rawCookieValue: string,
  options: VerifySessionCookieOptions,
): Promise<SessionCookieVerificationResult> {
  if (!rawCookieValue || !options.secret || !globalThis.crypto?.subtle) {
    return { status: 'invalid', reason: 'format' };
  }

  let sawSignedFormat = false;
  let sawValidHmac = false;

  for (const signedValue of cookieValueCandidates(rawCookieValue)) {
    const lastDot = signedValue.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === signedValue.length - 1) continue;
    sawSignedFormat = true;

    const payload = signedValue.slice(0, lastDot);
    const signature = signedValue.slice(lastDot + 1);
    if (!await verifyHmac(payload, signature, options.secret)) continue;
    sawValidHmac = true;

    const claims = parseSessionCookiePayload(
      payload,
      options.maxAgeSeconds ?? DEFAULT_SESSION_MAX_AGE_SECONDS,
      options.now,
    );
    if (claims) return { status: 'valid', claims };
  }

  if (sawValidHmac) return { status: 'invalid', reason: 'payload' };
  if (sawSignedFormat) return { status: 'invalid', reason: 'hmac' };
  return { status: 'invalid', reason: 'format' };
}

/** Read a cookie value from a Cookie request header without trusting its data. */
export function readCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  if (signature.length !== HMAC_SHA256_BASE64URL_LENGTH) return false;

  const signatureBytes = decodeBase64Url(signature);
  if (!signatureBytes || signatureBytes.length !== 32) return false;

  try {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}

function cookieValueCandidates(raw: string): string[] {
  const candidates = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) candidates.push(decoded);
  } catch {
    // A malformed percent escape is simply an invalid cookie candidate.
  }
  return candidates;
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  const bytes: number[] = [];
  let accumulator = 0;
  let bits = 0;

  for (const char of value) {
    const digit = BASE64URL_ALPHABET.indexOf(char);
    if (digit === -1) return null;
    accumulator = (accumulator << 6) | digit;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((accumulator >> bits) & 0xff);
      accumulator &= (1 << bits) - 1;
    }
  }

  // Reject non-canonical encodings whose unused trailing bits are non-zero.
  if (bits > 0 && accumulator !== 0) return null;
  return new Uint8Array(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidUser(value: unknown): value is AuthUser {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.email === 'string'
    && value.email.length > 0
    && (value.role === undefined || value.role === null || typeof value.role === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
