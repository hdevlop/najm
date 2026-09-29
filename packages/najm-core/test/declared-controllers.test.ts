import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Controller, Meta, Service, getDecoratorMetadataValue } from 'diject';
import { Get } from '../src/router';
import { Server } from '../src/server';
import { plugin } from '../src/server/plugin';
import { DECLARED_PLUGIN_BOOT_SERVICES } from '../src/server/tokens';

class ImportedOnly {
  read() { return { imported: true }; }
}
Controller('/imported-only')(ImportedOnly);
Get('/')(ImportedOnly.prototype, 'read', Object.getOwnPropertyDescriptor(ImportedOnly.prototype, 'read')!);
Meta({ layer: 'plugin' })(ImportedOnly);

class DeclaredByPlugin {
  read() { return { declared: true }; }
}
Controller('/declared-plugin')(DeclaredByPlugin);
Get('/')(DeclaredByPlugin.prototype, 'read', Object.getOwnPropertyDescriptor(DeclaredByPlugin.prototype, 'read')!);

let lazyServiceConstructions = 0;
@Service()
class LazyPluginService {
  constructor() { lazyServiceConstructions++; }
}

describe('declared controller mounting', () => {
  test('mounts only controllers declared to this server, even when imports already have a layer', async () => {
    const server = new Server({ isolated: true, silent: true })
      .use(plugin('declared-probe').services(DeclaredByPlugin, LazyPluginService).build());
    // A package import can register a decorated class in the server container.
    // It still must not become a route without .load() or plugin .services().
    server.container.set(ImportedOnly, { metadata: { layer: 'plugin' } });
    try {
      expect(getDecoratorMetadataValue(LazyPluginService, 'layer')).toBeUndefined();
      expect(lazyServiceConstructions).toBe(0);
      await server.init();
      expect((server.container.get(DECLARED_PLUGIN_BOOT_SERVICES) as Set<Function>).has(LazyPluginService)).toBe(false);
      expect(lazyServiceConstructions).toBe(0);
      expect((await server.fetch(new Request('http://local/imported-only'))).status).toBe(404);
      const response = await server.fetch(new Request('http://local/declared-plugin'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ declared: true });
      expect(lazyServiceConstructions).toBe(0);
    } finally {
      await server.stop();
    }
  });
});
