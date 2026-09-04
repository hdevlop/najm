import { describe, test, expect } from 'bun:test';
import type { Context } from 'hono';
import { socketPeerAddress } from '../src/peerAddress';

const contextWith = (env: unknown, raw = new Request('http://localhost/')) =>
  ({ env, req: { raw } }) as unknown as Context;

describe('socket peer resolution', () => {
  test('reads the Bun server binding', () => {
    const context = contextWith({
      requestIP: () => ({ address: '203.0.113.7', family: 'IPv4', port: 1234 }),
    });

    expect(socketPeerAddress(context)).toBe('203.0.113.7');
  });

  test('reads a Bun binding nested under `server`', () => {
    const context = contextWith({
      server: { requestIP: () => ({ address: '198.51.100.4' }) },
    });

    expect(socketPeerAddress(context)).toBe('198.51.100.4');
  });

  test('reads the Node adapter socket', () => {
    const context = contextWith({ incoming: { socket: { remoteAddress: '::1' } } });

    expect(socketPeerAddress(context)).toBe('::1');
  });

  test('reads the Deno remote address', () => {
    const context = contextWith({ remoteAddr: { hostname: '10.0.0.4' } });

    expect(socketPeerAddress(context)).toBe('10.0.0.4');
  });

  test('a runtime exposing no peer yields undefined rather than a guess', () => {
    expect(socketPeerAddress(contextWith(undefined))).toBeUndefined();
    expect(socketPeerAddress(contextWith(null))).toBeUndefined();
    expect(socketPeerAddress(contextWith({}))).toBeUndefined();
    expect(socketPeerAddress(undefined)).toBeUndefined();
  });

  test('a peer lookup that throws is treated as no peer', () => {
    const context = contextWith({
      requestIP: () => {
        throw new Error('socket already closed');
      },
    });

    expect(socketPeerAddress(context)).toBeUndefined();
  });

  test('forwarding headers are never consulted for the peer', () => {
    const raw = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '192.0.2.44', 'x-real-ip': '192.0.2.45' },
    });

    expect(socketPeerAddress(contextWith({}, raw))).toBeUndefined();
  });
});
