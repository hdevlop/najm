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

/**
 * Warnings are emitted once per distinct cause. A misdeclared topology affects
 * every request, so repeating the message per request would flood the log
 * without adding information.
 *
 * No message ever includes header content. A forwarded chain is
 * attacker-controlled input, and these warnings are meant to be safe to ship to
 * aggregated logs.
 */
const emittedWarnings = new Set<string>();

function warnOnce(cause: string, message: string): void {
  if (emittedWarnings.has(cause)) return;
  emittedWarnings.add(cause);
  console.warn(`[najm/rate] ${message}`);
}

/** Forget which warnings have been emitted. Intended for tests. */
export function resetClientAddressWarnings(): void {
  emittedWarnings.clear();
}

/**
 * Report that a request could not be attributed to a client.
 *
 * `UNRESOLVED_CLIENT_ADDRESS` is a safe outcome — it never disables the limiter
 * — but it is also indistinguishable at runtime from a correctly configured
 * deployment, because every affected request shares one bucket instead of
 * getting its own. That collapse is the observable symptom of a hop count that
 * does not match the real proxy chain, so it is announced rather than absorbed.
 */
function unresolved(cause: string, message: string): string {
  warnOnce(cause, `${message} Until this is corrected, every affected request shares one rate-limit bucket.`);
  return UNRESOLVED_CLIENT_ADDRESS;
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
 *   It must come from the connection itself. A header-derived value is client
 *   input, and passing one here would let a client pick its own bucket at
 *   `trustedProxyHops: 0`, which is precisely the setting that refuses headers.
 */
export function resolveClientAddress(
  headers: Record<string, string | undefined>,
  trustedProxyHops: number | undefined,
  peerIp?: string,
): string {
  if (trustedProxyHops === undefined) {
    warnOnce(
      'legacy',
      'trustedProxyHops is not configured, so rate-limit keys fall back to the ' +
        'leftmost X-Forwarded-For value. That value is set by the client and can ' +
        'be rotated to mint a fresh bucket per request. Declare the number of ' +
        'proxies in front of this application to opt into the trusted-hop contract.',
    );
    return legacyAddress(headers, peerIp);
  }

  assertHops(trustedProxyHops);

  if (trustedProxyHops === 0) {
    const peer = normalizeAddress(peerIp);
    if (peer) return peer;
    return unresolved(
      'peer',
      'trustedProxyHops is 0, so the socket peer address is the only trusted ' +
        'source, but the runtime did not expose a usable one.',
    );
  }

  const forwarded = headers['x-forwarded-for'];
  if (!forwarded) {
    return unresolved(
      'missing-chain',
      `trustedProxyHops is ${trustedProxyHops}, but requests are arriving with no ` +
        'X-Forwarded-For header. Either the edge proxy is not setting it, or the ' +
        'application is reachable without passing through that proxy.',
    );
  }

  const entries = forwarded.split(',');
  // The chain must actually be long enough to contain the boundary; a short
  // chain means the request did not traverse the declared topology.
  if (entries.length < trustedProxyHops) {
    return unresolved(
      'short-chain',
      `The forwarded chain is shorter than the declared trustedProxyHops of ` +
        `${trustedProxyHops}, so the trusted boundary is not present in it. The ` +
        'configured topology does not match the proxies actually in front of this ' +
        'application.',
    );
  }

  const candidate = entries[entries.length - trustedProxyHops];
  const resolved = normalizeAddress(candidate);
  if (resolved) return resolved;

  return unresolved(
    'unusable-boundary',
    `The chain element at hop ${trustedProxyHops} is not a bare IP literal, so it ` +
      'cannot be used as key material.',
  );
}
