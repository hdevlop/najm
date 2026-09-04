// ============================================================
// peerAddress.ts - Socket peer resolution
// ============================================================

import type { Context } from 'hono';

/**
 * Read the address of the peer that actually opened the connection.
 *
 * `HRequest.ip` cannot be used for this. It is derived from forwarding headers
 * — the exact values a trusted-hop contract exists to distrust — so treating it
 * as the peer would let a client choose its own rate-limit bucket while
 * appearing to bypass forwarded headers entirely.
 *
 * Each runtime adapter exposes the real remote address in its own place, all
 * reachable through the binding the server forwards as `c.env`. A runtime that
 * exposes none returns `undefined`, and the caller fails closed rather than
 * falling back to header input.
 */
export function socketPeerAddress(context: Context | undefined): string | undefined {
  const env = context?.env as Record<string, any> | undefined | null;
  if (!env || !context) return undefined;

  try {
    // Bun: the binding is the `Server` itself, which maps a Request to its peer.
    const bunServer = typeof env === 'object' && 'server' in env ? env.server : env;
    if (bunServer && typeof bunServer.requestIP === 'function') {
      const address = bunServer.requestIP(context.req.raw)?.address;
      if (address) return String(address);
    }

    // @hono/node-server: the raw Node socket.
    const nodeAddress = env.incoming?.socket?.remoteAddress;
    if (nodeAddress) return String(nodeAddress);

    // Deno.serve.
    const denoAddress = env.remoteAddr?.hostname;
    if (denoAddress) return String(denoAddress);
  } catch {
    // A runtime that refuses to answer is treated as exposing no peer at all.
  }

  return undefined;
}
