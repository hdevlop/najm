import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { createAlsToken } from 'diject';
import {
  Controller,
  Get,
  Headers,
  Middleware,
  Post,
  Req,
  ResCreated,
  ResNoContent,
  Server,
  created,
} from '../dist/index.mjs';

function decorateClass(target: Function, ...decorators: ClassDecorator[]) {
  for (const decorator of decorators.reverse()) decorator(target);
}

function decorateMethod(target: object, methodName: string, ...decorators: MethodDecorator[]) {
  const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
  if (!descriptor) throw new Error(`Missing descriptor for ${methodName}`);
  for (const decorator of decorators.reverse()) decorator(target, methodName, descriptor);
}

const servers: Server[] = [];
function track(server: Server): Server {
  servers.push(server);
  return server;
}

afterEach(async () => {
  while (servers.length) await servers.pop()!.stop().catch(() => {});
});

describe('HEAD requests', () => {
  test('finish request cleanup so shutdown does not wait for the drain timeout', async () => {
    class HeadController {
      raw() {
        return new Response('streamed body');
      }
      json() {
        return { ok: true };
      }
    }
    decorateMethod(HeadController.prototype, 'raw', Get('/raw'));
    decorateMethod(HeadController.prototype, 'json', Get('/json'));
    decorateClass(HeadController, Controller('/head'));

    const server = track(new Server({ isolated: true, silent: true, shutdownTimeout: 5_000 }).load(HeadController));

    const raw = await server.fetch(new Request('http://localhost/head/raw', { method: 'HEAD' }));
    const json = await server.fetch(new Request('http://localhost/head/json', { method: 'HEAD' }));
    const missing = await server.fetch(new Request('http://localhost/nope', { method: 'HEAD' }));
    expect([raw.status, json.status, missing.status]).toEqual([200, 200, 404]);
    expect(raw.body).toBeNull();

    // GET bodies are still delivered through the lifecycle wrapper.
    const get = await server.fetch(new Request('http://localhost/head/raw'));
    expect(await get.text()).toBe('streamed body');

    const started = Date.now();
    await server.stop();
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('@Middleware() classes', () => {
  test('run when loaded into an isolated server as a class or a module object', async () => {
    for (const load of ['class', 'module'] as const) {
      let hits = 0;
      class CountingMiddleware {
        async use(_ctx: unknown, next: () => Promise<void>) {
          hits++;
          await next();
        }
      }
      decorateClass(CountingMiddleware, Middleware());

      class PingController {
        ping() {
          return 'pong';
        }
      }
      decorateMethod(PingController.prototype, 'ping', Get('/'));
      decorateClass(PingController, Controller('/ping'));

      const server = track(new Server({ isolated: true, silent: true }));
      if (load === 'class') server.load(PingController, CountingMiddleware);
      else server.load({ PingController, CountingMiddleware });

      const response = await server.fetch(new Request('http://localhost/ping'));
      expect(await response.text()).toBe('pong');
      expect({ load, hits }).toEqual({ load, hits: 1 });
    }
  });
});

describe('cookies', () => {
  test('a malformed percent-encoded cookie keeps its raw value instead of failing the request', async () => {
    class CookieController {
      read(req: any) {
        return req.cookies;
      }
    }
    decorateMethod(CookieController.prototype, 'read', Get('/'));
    Req()(CookieController.prototype, 'read', 0);
    decorateClass(CookieController, Controller('/cookies'));

    const server = track(new Server({ isolated: true, silent: true }).load(CookieController));
    const response = await server.fetch(new Request('http://localhost/cookies', {
      headers: { cookie: 'bad=%E0%A4%A; good=a%20b' },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bad: '%E0%A4%A', good: 'a b' });
  });
});

describe('response status', () => {
  test('created() responds 201 and does not leak statusCode into the body', async () => {
    class CreatedController {
      create() {
        return created({ id: 1 });
      }
    }
    decorateMethod(CreatedController.prototype, 'create', Post('/'));
    decorateClass(CreatedController, Controller('/created'));

    const server = track(new Server({ isolated: true, silent: true }).load(CreatedController));
    const response = await server.fetch(new Request('http://localhost/created', { method: 'POST' }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: 1 }, status: 'success' });
  });

  test('@ResCreated() and @ResNoContent() apply without autoWrap or a message', async () => {
    class StatusController {
      createObject() {
        return { id: 2 };
      }
      createText() {
        return 'made';
      }
      remove() {
        return { removed: true };
      }
    }
    decorateMethod(StatusController.prototype, 'createObject', Post('/object'), ResCreated());
    decorateMethod(StatusController.prototype, 'createText', Post('/text'), ResCreated());
    decorateMethod(StatusController.prototype, 'remove', Post('/remove'), ResNoContent());
    decorateClass(StatusController, Controller('/status'));

    const server = track(new Server({ isolated: true, silent: true }).load(StatusController));
    const post = (path: string) => server.fetch(new Request(`http://localhost/status${path}`, { method: 'POST' }));

    const object = await post('/object');
    expect(object.status).toBe(201);
    expect(await object.json()).toEqual({ id: 2 });

    const text = await post('/text');
    expect(text.status).toBe(201);
    expect(await text.text()).toBe('made');

    const removed = await post('/remove');
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe('');
  });

  test('@ResNoContent() with autoWrap sends an empty 204 instead of throwing', async () => {
    class WrappedController {
      remove() {
        return { removed: true };
      }
    }
    decorateMethod(WrappedController.prototype, 'remove', Post('/'), ResNoContent());
    decorateClass(WrappedController, Controller('/wrapped'));

    const previous = process.env.ROUTER_AUTO_WRAP;
    process.env.ROUTER_AUTO_WRAP = 'true';
    let response: Response;
    try {
      const server = track(new Server({ isolated: true, silent: true }).load(WrappedController));
      response = await server.fetch(new Request('http://localhost/wrapped', { method: 'POST' }));
    } finally {
      if (previous === undefined) delete process.env.ROUTER_AUTO_WRAP;
      else process.env.ROUTER_AUTO_WRAP = previous;
    }

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});

describe('validated headers', () => {
  test('@Headers() with a mixed-case name reads the lowercase validated header', async () => {
    const VALIDATED_HEADERS = createAlsToken<any>('validated:headers');

    class LangController {
      lang(language: unknown) {
        return { language };
      }
    }
    decorateMethod(LangController.prototype, 'lang', Get('/'));
    Headers('X-Language')(LangController.prototype, 'lang', 0);
    decorateClass(LangController, Controller('/lang'));

    const server = track(new Server({ isolated: true, silent: true }).load(LangController));
    // Stand in for najm-validation: validated headers are schema output over
    // the lowercase raw header map.
    server.middleware(async (_ctx, next) => {
      server.container.set(VALIDATED_HEADERS, { 'x-language': 'ar' });
      await next();
    });

    const response = await server.fetch(new Request('http://localhost/lang', {
      headers: { 'x-language': 'ignored-raw' },
    }));
    expect(await response.json()).toEqual({ language: 'ar' });
  });
});
