import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Server } from '../dist/index.mjs';

/**
 * The runtime hands its connection binding to the fetch handler as a second
 * argument, and that binding is the only route to the socket peer. Dropping it
 * is invisible here — routes keep working and every other core test passes —
 * but it silently removes peer resolution from anything downstream that needs
 * to distinguish a real connection from a forwarding header.
 */
describe('runtime connection binding', () => {
  const probe = (server: Server) => {
    const seen: { env?: unknown } = {};
    (server.app as any).get('/binding-probe', (context: any) => {
      seen.env = context.env;
      return context.json({ ok: true });
    });
    return seen;
  };

  test("the listener's second argument reaches the Hono context", async () => {
    const server = new Server({ isolated: true, silent: true });
    const seen = probe(server);

    const handler = (server as any).createFetchHandler();
    const binding = { marker: 'runtime-connection-binding' };
    await handler(new Request('http://localhost/binding-probe'), binding);

    expect(seen.env).toBe(binding);
  });

  test('a live listener supplies a binding that can answer for the peer', async () => {
    const server = new Server({ isolated: true, silent: true });
    const seen = probe(server);

    await server.listen(0);
    try {
      const response = await fetch(`http://localhost:${server.port}/binding-probe`);
      expect(response.status).toBe(200);
    } finally {
      await server.stop();
    }

    expect(seen.env).toBeDefined();
    // Under Bun the binding is the Server itself, whose requestIP() is the only
    // way to learn the peer address without trusting a header.
    expect(typeof (seen.env as any).requestIP).toBe('function');
  });

  test('a handler invoked without a binding still serves the request', async () => {
    const server = new Server({ isolated: true, silent: true });
    const seen = probe(server);

    const handler = (server as any).createFetchHandler();
    const response = await handler(new Request('http://localhost/binding-probe'));

    expect(response.status).toBe(200);
    expect(seen.env).toBeUndefined();
  });
});
