import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  Controller,
  Container,
  Get,
  INJECTION_TYPES,
  Meta,
  MetaHelper,
  Post,
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

const VALIDATE_META = Symbol.for('najm:validate');

function schema(type: string, extra: Record<string, unknown> = {}) {
  return {
    _zod: {
      def: {
        type,
        ...extra,
      },
    },
    parse(value: unknown) {
      return value;
    },
  };
}

function objectSchema(shape: Record<string, unknown>) {
  return schema('object', { shape });
}

function optionalSchema(innerType: unknown) {
  return schema('optional', { innerType });
}

function setValidation(
  target: object,
  methodName: string,
  config: Record<string, unknown>,
) {
  MetaHelper.define(VALIDATE_META, config, (target as any)[methodName]);
}

describe('core review plan regressions', () => {
  afterEach(() => {
    delete process.env.NAJM_DEBUG;
  });

  test('keeps injections isolated when distinct constructors share a name', () => {
    const FirstController = class SharedName {};
    const SecondController = class SharedName {};
    const container = new Container();

    container.setInjection({
      type: INJECTION_TYPES.MIDDLEWARE,
      target: FirstController,
      marker: 'first-only',
    });
    container.setInjection({
      type: INJECTION_TYPES.MIDDLEWARE,
      target: SecondController,
      marker: 'second-only',
    });

    expect(FirstController.name).toBe(SecondController.name);
    expect(container.getInjectionsFor<any>(INJECTION_TYPES.MIDDLEWARE, FirstController))
      .toEqual([expect.objectContaining({ target: FirstController, marker: 'first-only' })]);
    expect(container.getInjectionsFor<any>(INJECTION_TYPES.MIDDLEWARE, SecondController))
      .toEqual([expect.objectContaining({ target: SecondController, marker: 'second-only' })]);
  });

  test('does not run diagnostics for a default global server', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalLogFormat = process.env.LOG_FORMAT;
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_FORMAT;

    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...messages: unknown[]) => {
      logs.push(messages.map(String).join(' '));
    };

    try {
      const server = new Server();
      await server.init();
      await server.stop();
    } finally {
      console.log = originalLog;
      process.env.NODE_ENV = originalNodeEnv;
      if (originalLogFormat !== undefined) process.env.LOG_FORMAT = originalLogFormat;
    }

    const messages = logs.map((line) => JSON.parse(line).message as string);
    expect(messages).toEqual([
      'Initializing server...',
      expect.stringMatching(/^Server initialized in \d+ms$/),
      'Server stopped gracefully',
    ]);
    expect(messages).not.toContain('Boot diagnostics');
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

  test('generates an OpenAPI document from registered routes and validation metadata', async () => {
    class OpenApiUsersController {
      list() {
        return [];
      }

      create() {
        return { id: '1' };
      }

      show() {
        return { id: '1' };
      }
    }
    decorateMethod(OpenApiUsersController.prototype, 'list', Get('/'));
    decorateMethod(OpenApiUsersController.prototype, 'create', Post('/'));
    decorateMethod(OpenApiUsersController.prototype, 'show', Get('/:id'));
    setValidation(OpenApiUsersController.prototype, 'list', {
      query: objectSchema({
        page: optionalSchema(schema('string')),
      }),
    });
    setValidation(OpenApiUsersController.prototype, 'create', {
      body: objectSchema({
        email: schema('string', {
          checks: [{ _zod: { def: { check: 'string_format', format: 'email' } } }],
        }),
        name: schema('string'),
      }),
    });
    setValidation(OpenApiUsersController.prototype, 'show', {
      params: objectSchema({
        id: schema('string'),
      }),
    });
    decorateClass(OpenApiUsersController, Controller('/users'));

    const server = new Server({ isolated: true, silent: true })
      .base('/api')
      .load(OpenApiUsersController);

    const document = await server.openapi({
      title: 'Test API',
      version: '2.0.0',
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
    });

    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Test API');
    expect(document.paths['/api/users'].get.operationId).toBe('OpenApiUsersController_list');
    expect(document.paths['/api/users'].get.parameters?.[0]).toMatchObject({
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    });
    expect(document.paths['/api/users'].post.requestBody?.content['application/json'].schema)
      .toMatchObject({
        type: 'object',
        required: ['email', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
        },
      });
    expect(document.paths['/api/users/{id}'].get.parameters?.[0]).toMatchObject({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    await server.stop();
  });
});
