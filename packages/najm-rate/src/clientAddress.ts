// ============================================================
// clientAddress.ts - Trusted-hop client address resolution
// ============================================================

/**
 * Bucket used when a forwarded chain is required but cannot be trusted.
 *
 * It is deliberately a single fixed token: requests with an unusable chain
 * share one bounded bucket instead of minting a fresh, attacker-selected key
 * per request. Rate limiting is never disabled by a malformed header.
 */
export const UNRESOLVED_CLIENT_ADDRESS = 'unresolved';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_CHARS = /^[0-9a-f:]+$/;
/** Longest possible textual IPv6 address, so one header element stays bounded. */
const MAX_ADDRESS_LENGTH = 45;

function normalizeIpv4(value: string): string | null {
  const match = IPV4.exec(value);
  if (!match) return null;
  for (let index = 1; index <= 4; index += 1) {
    const octet = match[index]!;
    // Reject "01" style padding so one address cannot occupy two buckets.
    if (octet.length > 1 && octet.startsWith('0')) return null;
    if (Number(octet) > 255) return null;
  }
  return value;
}

function normalizeIpv6(value: string): string | null {
  const lowered = value.toLowerCase();

  // An IPv4-mapped address is the same client as its IPv4 form; collapse it so
  // the two spellings cannot occupy separate buckets.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lowered);
  if (mapped) return normalizeIpv4(mapped[1]!);

  if (!IPV6_CHARS.test(lowered)) return null;
  if (!lowered.includes(':')) return null;
  // At most one "::" run, and no malformed ":::" sequences.
  if (lowered.includes(':::')) return null;
  if (lowered.split('::').length > 2) return null;

  const groups = lowered.replace('::', ':').split(':').filter(Boolean);
  if (groups.length > 8) return null;
  for (const group of groups) {
    if (group.length > 4) return null;
  }

  return lowered;
}

/**
 * Normalize one chain element into stable key material.
 * Returns null for anything that is not an unadorned IP literal — ports,
 * malformed text, empty elements, and oversized tokens all fail here rather
 * than becoming a cache key.
 */
export function normalizeAddress(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value || value.length > MAX_ADDRESS_LENGTH) return null;

  // "[2001:db8::1]" and "[2001:db8::1]:443"
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end === -1) return null;
    value = value.slice(1, end);
    return normalizeIpv6(value);
  }

  // "::ffff:1.2.3.4" carries both separators, so it is classified before the
  // IPv4 branch rejects the colon as a port.
  if (value.toLowerCase().startsWith('::ffff:')) return normalizeIpv6(value);

  if (value.includes('.')) {
    // A trailing ":port" on an IPv4 literal is not an address.
    if (value.includes(':')) return null;
    return normalizeIpv4(value);
  }

  return normalizeIpv6(value);
}

function assertHops(trustedProxyHops: number): void {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error(
      `[najm/rate] trustedProxyHops must be a non-negative integer, received ${String(trustedProxyHops)}`,
    );
  }
}

/**
 * Historical behavior: trust the leftmost forwarded value.
 *
 * @deprecated Client-controlled and spoofable. It remains only so consumers
 * that have not yet declared their topology keep working, and is scheduled for
 * removal in the next major release. Set `trustedProxyHops` to opt into the
 * secure contract.
 */
function legacyAddress(
  headers: Record<string, string | undefined>,
  peerIp?: string,
): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? UNRESOLVED_CLIENT_ADDRESS;

  const realIp = headers['x-real-ip'];
  if (realIp) return realIp;

  return peerIp ?? UNRESOLVED_CLIENT_ADDRESS;
}

/**
 * Resolve the address used as rate-limit key material.
 *
 * @param headers Lowercased request headers.
 * @param trustedProxyHops Number of known proxies between the app and the
 *   client. `0` refuses forwarded headers and uses the socket peer. A positive
 *   value indexes the `X-Forwarded-For` chain from the right, so values an
 *   attacker prepends sit to the left of the boundary and are ignored.
 *   `undefined` selects the deprecated legacy path.
 * @param peerIp The socket-level remote address, when the runtime exposes one.
 */
export function resolveClientAddress(
  headers: Record<string, string | undefined>,
  trustedProxyHops: number | undefined,
  peerIp?: string,
): string {
  if (trustedProxyHops === undefined) return legacyAddress(headers, peerIp);

  assertHops(trustedProxyHops);

  if (trustedProxyHops === 0) {
    return normalizeAddress(peerIp) ?? UNRESOLVED_CLIENT_ADDRESS;
  }

  const forwarded = headers['x-forwarded-for'];
  if (!forwarded) return UNRESOLVED_CLIENT_ADDRESS;

  const entries = forwarded.split(',');
  // The chain must actually be long enough to contain the boundary; a short
  // chain means the request did not traverse the declared topology.
  if (entries.length < trustedProxyHops) return UNRESOLVED_CLIENT_ADDRESS;

  const candidate = entries[entries.length - trustedProxyHops];
  return normalizeAddress(candidate) ?? UNRESOLVED_CLIENT_ADDRESS;
}
