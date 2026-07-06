import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  Controller,
  Get,
  INJECTION_TYPES,
  Meta,
  RequestParser,
  Server,
  Service,
  plugin,
} from '../dist/index.mjs';

function decorateClass(target: Function, ...decorators: ClassDecorator[]) {
  for (const decorator of decorators.reverse()) {
    decorator(target);
  }
}

function decorateMethod(
  target: object,
  methodName: string,
  ...decorators: MethodDecorator[]
) {
  const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
  if (!descriptor) {
    throw new Error(`Missing descriptor for ${methodName}`);
  }

  for (const decorator of decorators.reverse()) {
    decorator(target, methodName, descriptor);
  }
}

describe('core review plan regressions', () => {
  afterEach(() => {
    delete process.env.NAJM_DEBUG;
  });

  test('validates string plugin dependencies after all plugins are registered', async () => {
    const needsDatabase = plugin('needs-database').requires('database').build();
    const database = plugin('database').build();

    const server = new Server({ isolated: true, silent: true })
      .use(needsDatabase)
      .use(database);

    await expect(server.init()).resolves.toBe(server);
    await server.stop();
  });

  test('reports all missing string plugin dependencies at initialization', async () => {
    const server = new Server({ isolated: true, silent: true })
      .use(plugin('auth').requires('database').build())
      .use(plugin('reports').requires('cache').build());

    await expect(server.init()).rejects.toThrow('auth -> database');
    await expect(server.init()).rejects.toThrow('reports -> cache');
  });

  test('stop runs onDestroy for fetch-only initialized servers and prevents reuse', async () => {
    let destroyed = 0;

    class DestroyableService {
      async onDestroy() {
        destroyed++;
      }
    }
    decorateClass(DestroyableService, Service(), Meta({ layer: 'plugin', order: 1 }));

    const server = new Server({ isolated: true, silent: true })
      .use(plugin('destroyable').services(DestroyableService).build());

    await server.init();
    expect(server.isRunning).toBe(false);

    await server.stop();

    expect(destroyed).toBe(1);
    await expect(server.init()).rejects.toThrow('Server was stopped');
  });

  test('stop preserves destroy failures as the error cause', async () => {
    class FailingDestroyService {
      async onDestroy() {
        throw new Error('destroy exploded');
      }
    }
    decorateClass(FailingDestroyService, Service(), Meta({ layer: 'plugin', order: 1 }));

    const server = new Server({ isolated: true, silent: true })
      .use(plugin('failing-destroy').services(FailingDestroyService).build());

    await server.init();

    await expect(server.stop()).rejects.toThrow('destroy exploded');
  });

  test('dedupes app services registered by repeated load calls', async () => {
    class DuplicateController {
      list() {
        return [];
      }
    }
    decorateMethod(DuplicateController.prototype, 'list', Get('/items'));
    decorateClass(DuplicateController, Controller('/dupe'));

    const server = new Server({ isolated: true, silent: true })
      .load(DuplicateController, DuplicateController);

    await server.init();

    const routes = server.container.getInjections(INJECTION_TYPES.ROUTE);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/dupe/items');

    await server.stop();
  });

  test('RequestParser lazily resolves route params and query values', () => {
    let paramCalls = 0;
    let queryCalls = 0;

    const parser = new RequestParser({
      req: {
        param: () => {
          paramCalls++;
          return { id: '123' };
        },
        query: () => {
          queryCalls++;
          return { search: 'najm' };
        },
        queries: () => ['najm'],
        path: '/items/123',
        url: 'http://localhost/items/123?search=najm',
        method: 'GET',
        raw: new Request('http://localhost/items/123?search=najm'),
        routePath: '/items/:id',
        matchedRoutes: [],
        routeIndex: 0,
        header: () => undefined,
        json: async () => ({}),
        text: async () => '',
        arrayBuffer: async () => new ArrayBuffer(0),
        blob: async () => new Blob(),
        formData: async () => new FormData(),
        valid: () => undefined,
      },
    } as any);

    const request = parser.createRequest();

    expect(paramCalls).toBe(0);
    expect(queryCalls).toBe(0);
    expect(request.params.id).toBe('123');
    expect(request.params.id).toBe('123');
    expect(request.query.search).toBe('najm');
    expect(request.query.search).toBe('najm');
    expect(paramCalls).toBe(1);
    expect(queryCalls).toBe(1);
  });

  test('logger defaults to JSON without colors when NODE_ENV=production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalLogFormat = process.env.LOG_FORMAT;
    const originalNoColor = process.env.NO_COLOR;
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_FORMAT;
    delete process.env.NO_COLOR;

    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...messages: unknown[]) => {
      logs.push(messages.map(String).join(' '));
    };

    try {
      const server = new Server({ isolated: true });
      await server.init();
      await server.stop();
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalNodeEnv;
      if (originalLogFormat !== undefined) process.env.LOG_FORMAT = originalLogFormat;
      if (originalNoColor !== undefined) process.env.NO_COLOR = originalNoColor;
    }

    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(() => JSON.parse(line)).not.toThrow();
      expect(line).not.toMatch(/\x1b\[/);
    }
  });

  test('diagnostics mode logs the route table', async () => {
    class DiagnosticsController {
      ping() {
        return { ok: true };
      }
    }
    decorateMethod(DiagnosticsController.prototype, 'ping', Get('/ping'));
    decorateClass(DiagnosticsController, Controller('/diag'));

    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...messages: unknown[]) => {
      logs.push(messages.map(String).join(' '));
    };

    try {
      const server = new Server({
        isolated: true,
        diagnostics: true,
        logger: {
          colors: false,
          includeRequestId: false,
          includeTimestamp: false,
          level: 'INFO',
        },
      }).load(DiagnosticsController);

      await server.init();
      await server.stop();
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.includes('Routes (1)'))).toBe(true);
    expect(logs.some((line) => line.includes('GET') && line.includes('/diag/ping'))).toBe(true);
  });
});
