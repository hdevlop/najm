// ============================================================================
// JWT Token Decoder (client-side, no verification)
// ============================================================================
// Decodes the JWT payload using base64. No crypto required.
// This is safe for the client — the server verifies signatures.

import type { DecodedToken } from './types';

/**
 * Decode a JWT token payload without verification.
 * Returns null if the token is malformed.
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url → base64 → decode
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const json = typeof atob === 'function'
      ? atob(payload)
      : Buffer.from(payload, 'base64').toString('utf-8');

    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check if a decoded token is expired.
 */
export function isTokenExpired(decoded: DecodedToken): boolean {
  // A token with no exp claim is malformed for our server (access tokens always
  // carry exp). Treat it as expired so the client refreshes rather than trusting
  // it indefinitely.
  if (!decoded.exp) return true;
  return Date.now() / 1000 >= decoded.exp;
}

/**
 * Get remaining seconds until token expires.
 * Returns 0 if already expired or no exp claim.
 */
export function getTokenTTL(decoded: DecodedToken): number {
  if (!decoded.exp) return 0;
  return Math.max(0, decoded.exp - Date.now() / 1000);
}
