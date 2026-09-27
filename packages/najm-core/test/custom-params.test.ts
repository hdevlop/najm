import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  Controller,
  createAlsToken,
  createParamDecorator,
  Err,
  Get,
  INJECTION_TYPES,
  Params,
  Server,
  type ParamResolveContext,
} from '../dist/index.mjs';

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length) {
    await servers.pop()?.stop();
  }
});

async function boot(controller: Function, configure?: (server: Server) => void): Promise<Server> {
  const server = new Server({ isolated: true, silent: true }).load(controller);
  servers.push(server);
  configure?.(server);
  await server.init();
  return server;
}

async function get(server: Server, path: string, headers?: Record<string, string>) {
  const response = await server.fetch(new Request(`http://localhost${path}`, { headers }));
  return { status: response.status, body: await response.json() as any };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createParamDecorator', () => {
  test('injects an async value computed from the header, query and route params', async () => {
    const Selection = createParamDecorator(async ({ transport, header, query, param }) => {
      await sleep(1);
      return { transport, header: header('X-Selection'), query: query('year'), param: param('id') };
    });

    @Controller('/items')
    class ItemsController {
      @Get('/:id')
      read(@Selection() selection: unknown, @Params('id') id: string) {
        return { selection, id };
      }
    }

    const server = await boot(ItemsController);
    const { status, body } = await get(server, '/items/42?year=2025-2026', { 'x-selection': 'header-value' });

    expect(status).toBe(200);
    expect(body).toEqual({
      selection: { transport: 'http', header: 'header-value', query: '2025-2026', param: '42' },
      id: '42',
    });
  });

  test('keeps decorated positions when the custom parameter comes after a built-in one', async () => {
    const Answer = createParamDecorator(() => 42);

    @Controller('/positions')
    class PositionsController {
      @Get('/:id')
      read(@Params('id') id: string, @Answer() answer: number) {
        return { id, answer };
      }
    }

    const server = await boot(PositionsController);
    expect((await get(server, '/positions/a')).body).toEqual({ id: 'a', answer: 42 });
  });

  test('passes the options given to the decorator', async () => {
    const Echo = createParamDecorator((_context, options?: { label: string }) => options?.label ?? null);

    @Controller('/echo')
    class EchoController {
      @Get('/')
      read(@Echo({ label: 'first' }) first: string, @Echo() second: string | null) {
        return { first, second };
      }
    }

    const server = await boot(EchoController);
    expect((await get(server, '/echo')).body).toEqual({ first: 'first', second: null });
  });

  test('runs after the route middlewares, so values they publish are readable', async () => {
    const PROBE = createAlsToken<string>('custom-param:probe');
    const Probe = createParamDecorator(({ container }) => container.get(PROBE) ?? null);

    @Controller('/ordered')
    class OrderedController {
      @Get('/')
      read(@Probe() probe: string | null) {
        return { probe };
      }
    }

    const server = await boot(OrderedController, (server) => {
      server.container.setInjection({
        type: INJECTION_TYPES.MIDDLEWARE,
        target: OrderedController,
        methodName: 'read',
        order: 40,
        handler: async (_context: unknown, next: () => Promise<void>) => {
          server.container.set(PROBE, 'set-by-route-middleware');
          await next();
        },
      });
    });

    expect((await get(server, '/ordered')).body).toEqual({ probe: 'set-by-route-middleware' });
  });

  test('reads the validated query and params before the raw request', async () => {
    const Read = createParamDecorator(({ query, param }) => ({ year: query('year'), id: param('id') }));

    @Controller('/validated')
    class ValidatedController {
      @Get('/:id')
      read(@Read() read: unknown) {
        return read;
      }
    }

    const server = await boot(ValidatedController, (server) => {
      server.container.setInjection({
        type: INJECTION_TYPES.MIDDLEWARE,
        target: ValidatedController,
        methodName: 'read',
        order: 45,
        handler: async (_context: unknown, next: () => Promise<void>) => {
          server.container.set(createAlsToken('validated:query'), { year: 'validated-year' });
          server.container.set(createAlsToken('validated:params'), { id: 'validated-id' });
          await next();
        },
      });
    });

    expect((await get(server, '/validated/raw-id?year=raw-year')).body)
      .toEqual({ year: 'validated-year', id: 'validated-id' });
  });

  test('a rejected resolver fails the request before the handler runs', async () => {
    let handled = false;
    const Refuse = createParamDecorator(async () => {
      await sleep(1);
      return Err(403, 'Refused by the resolver');
    });

    @Controller('/refused')
    class RefusedController {
      @Get('/')
      read(@Refuse() value: unknown) {
        handled = true;
        return { value };
      }
    }

    const server = await boot(RefusedController);
    const { status, body } = await get(server, '/refused');

    expect(status).toBe(403);
    expect(JSON.stringify(body)).toContain('Refused by the resolver');
    expect(handled).toBe(false);
  });

  test('concurrent requests each receive their own value', async () => {
    const Slow = createParamDecorator(async ({ header }: ParamResolveContext) => {
      const value = header('x-value');
      await sleep(value === 'first' ? 30 : 1);
      return value;
    });

    @Controller('/concurrent')
    class ConcurrentController {
      @Get('/')
      async read(@Slow() value: string) {
        await sleep(20);
        return { value };
      }
    }

    const server = await boot(ConcurrentController);
    const [first, second] = await Promise.all([
      get(server, '/concurrent', { 'x-value': 'first' }),
      get(server, '/concurrent', { 'x-value': 'second' }),
    ]);

    expect(first.body).toEqual({ value: 'first' });
    expect(second.body).toEqual({ value: 'second' });
  });

  test('also resolves when some handler parameters are undecorated', async () => {
    const Answer = createParamDecorator(async () => 7);

    @Controller('/mixed')
    class MixedController {
      @Get('/')
      read(@Answer() answer: number, extra?: unknown) {
        return { answer, extra: extra ?? null };
      }
    }

    const server = await boot(MixedController);
    expect((await get(server, '/mixed')).body).toEqual({ answer: 7, extra: null });
  });

  test('requires a resolve function', () => {
    expect(() => createParamDecorator(undefined as never)).toThrow(TypeError);
  });
});
