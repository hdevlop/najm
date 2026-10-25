import { expect, test } from 'bun:test';
import { createAuthClient } from 'najm-auth/client';
import { connectPreparationLogout } from './support/app';

test('502 refresh failures preserve preparation, explicit logout clears it', async () => {
  const originalFetch = globalThis.fetch;
  const client = createAuthClient({ baseURL: 'https://offline-fixture.invalid/api', tabSync: false });
  const removed: string[] = [];
  const dispose = connectPreparationLogout(client, { removeItem: key => { removed.push(key); } });
  globalThis.fetch = Object.assign(async () => Response.json({ message: 'Unavailable' }, { status: 502 }), { preconnect: originalFetch.preconnect });
  try {
    client.hydrate({ user: { id: 'fixture', email: null }, permissions: [] });
    // Include the circuit-open path, which drops the SDK's current user.
    for (let attempt = 0; attempt < 3; attempt++) await client.refresh().catch(() => undefined);
    expect(client.getState().user).toBeNull();
    expect(removed).toEqual([]);
    await client.logout().catch(() => undefined);
    expect(removed).toEqual(['app.offline-shell.v1']);
  } finally { dispose(); client.destroy(); globalThis.fetch = originalFetch; }
});
