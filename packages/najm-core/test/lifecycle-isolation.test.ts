import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  Controller,
  CORRELATION_ID,
  Get,
  Injectable,
  Meta,
  Query,
  REQUEST_ID,
  Scope,
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
  if (!descriptor) throw new Error(`Missing descriptor for ${methodName}`);

  for (const decorator of decorators.reverse()) {
    decorator(target, methodName, descriptor);
  }
}

function decorateParam(target: object, methodName: string, index: number, decorator: ParameterDecorator) {
  decorator(target, methodName, index);
}

const servers: Server[] = [];

function track(server: Server): Server {
  servers.push(server);
  return server;
}

describe('core lifecycle and isolation', () => {
  afterEach(async () => {
    while (servers.length) {
      await servers.pop()?.stop().catch(() => {});
    }
  });

  test('a client x-request-id does not share request-scoped state across requests', async () => {
    class RequestState {
      user?: string;
    }
    decorateClass(RequestState, Injectable(Scope.REQUEST));

    let releaseAlice!: () => void;
    const aliceStored = new Promise<void>((resolve) => { releaseAlice = resolve; });
    let resumeAlice!: () => void;
    const aliceGate = new Promise<void>((resolve) => { resumeAlice = resolve; });

    class StateController {
      constructor(private readonly state: RequestState) {}

      async read(user: string) {
        if (user === 'alice') {
          this.state.user = 'alice';
          releaseAlice();
          await aliceGate;
        }
        return { seen: this.state.user ?? null };
      }
    }
    Reflect.defineMetadata('design:paramtypes', [RequestState], StateController);
    decorateParam(StateController.prototype, 'read', 0, Query('user'));
    decorateMethod(StateController.prototype, 'read', Get('/state'));
    decorateClass(StateController, Injectable(Scope.REQUEST), Controller('/iso'));

    const server = track(new Server({ isolated: true, silent: true }).load(RequestState, StateController));
    const headers = { 'x-request-id': 'shared-id' };

    const alice = server.fetch(new Request('http://localhost/iso/state?user=alice', { headers }));
    await aliceStored;
    const bob = await server.fetch(new Request('http://localhost/iso/state?user=bob', { headers }));
    resumeAlice();

    expect(await bob.json()).toEqual({ seen: null });
    expect(bob.headers.get('x-request-id')).toBe('shared-id');
    expect(await (await alice).json()).toEqual({ seen: 'alice' });
  });

  test('the client id is exposed as the correlation id, not the scope id', async () => {
    class IdController {
      ids() {
        const container = server.container;
        return { requestId: container.get(REQUEST_ID), correlationId: container.get(CORRELATION_ID) };
      }
    }
    decorateMethod(IdController.prototype, 'ids', Get('/ids'));
    decorateClass(IdController, Controller('/ids'));

    const server = track(new Server({ isolated: true, silent: true }).load(IdController));

    const supplied = await (await server.fetch(new Request('http://localhost/ids/ids', {
      headers: { 'x-request-id': 'client-id' },
    }))).json();
    expect(supplied.correlationId).toBe('client-id');
    expect(supplied.requestId).not.toBe('client-id');

    const generated = await server.fetch(new Request('http://localhost/ids/ids'));
    const body = await generated.json();
    expect(body.correlationId).toBe(body.requestId);
    expect(generated.headers.get('x-request-id')).toBe(body.requestId);
  });

  test('stop() bounds a stalled request by shutdownTimeout', async () => {
    let entered!: () => void;
    const handlerEntered = new Promise<void>((resolve) => { entered = resolve; });

    class StallController {
      async stall() {
        entered();
        await new Promise(() => {});
      }
    }
    decorateMethod(StallController.prototype, 'stall', Get('/stall'));
    decorateClass(StallController, Controller('/slow'));

    const server = new Server({ isolated: true, silent: true, shutdownTimeout: 20 }).load(StallController);
    await server.listen(41987);

    // The stalled client is only reset by the runtime's idle timeout; it is
    // deliberately not awaited.
    fetch('http://localhost:41987/slow/stall').catch(() => undefined);
    await handlerEntered;

    const startedAt = performance.now();
    await server.stop();
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  test('stop() closes idle keep-alive connections so a restart on the same port is reachable', async () => {
    const serve = (generation: number) => {
      class GenerationController {
        read() { return { generation }; }
      }
      decorateMethod(GenerationController.prototype, 'read', Get('/'));
      decorateClass(GenerationController, Controller('/generation'));
      return track(new Server({ isolated: true, silent: true }).load(GenerationController));
    };

    const first = serve(1);
    await first.listen(41988);
    for (let i = 0; i < 3; i++) {
      expect(await (await fetch('http://localhost:41988/generation')).json()).toEqual({ generation: 1 });
    }
    await first.stop();

    // fetch pools the first connection; it must not reach the stopped server.
    const second = serve(2);
    await second.listen(41988);
    const response = await fetch('http://localhost:41988/generation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ generation: 2 });
  });

  test('a failed startup tears down services that already booted', async () => {
    let opened = 0;
    let closed = 0;

    class EarlyResource {
      activate() { opened++; }
      onDestroy() { closed++; }
    }
    decorateClass(EarlyResource, Service(), Meta({ layer: 'plugin', order: 1 }));

    class LateFailure {
      activate() { throw new Error('late plugin failed'); }
    }
    decorateClass(LateFailure, Service(), Meta({ layer: 'plugin', order: 2 }));

    const server = new Server({ isolated: true, silent: true })
      .use(plugin('early').services(EarlyResource).build())
      .use(plugin('late').services(LateFailure).build());

    await expect(server.init()).rejects.toThrow('late plugin failed');
    expect(opened).toBe(1);
    expect(closed).toBe(1);
  });

  test('stop() runs onDestroy on app services', async () => {
    let destroyed = 0;

    class AppResource {
      onDestroy() { destroyed++; }
    }
    decorateClass(AppResource, Service());

    const server = new Server({ isolated: true, silent: true }).load(AppResource);
    await server.init();
    await server.stop();

    expect(destroyed).toBe(1);
  });

  test.each(['plugin', 'app'] as const)('failed %s boot tears down transient instances in reverse order', async (layer) => {
    const events: string[] = [];

    class FirstResource {
      onInit() { events.push('open:first'); }
      onDestroy() { events.push('close:first'); }
    }
    class SecondResource {
      onInit() { events.push('open:second'); }
      onDestroy() { events.push('close:second'); }
    }
    class LateFailure {
      onInit() { throw new Error('later init failed'); }
    }
    decorateClass(FirstResource, Injectable(Scope.TRANSIENT), Service(), Meta({ layer, order: 1 }));
    decorateClass(SecondResource, Injectable(Scope.TRANSIENT), Service(), Meta({ layer, order: 2 }));
    decorateClass(LateFailure, Service(), Meta({ layer, order: 3 }));

    const server = track(new Server({ isolated: true, silent: true }));
    if (layer === 'plugin') {
      server.use(plugin('partial-transients').services(FirstResource, SecondResource, LateFailure).build());
    } else {
      server.load(FirstResource, SecondResource, LateFailure);
    }

    await expect(server.init()).rejects.toThrow('later init failed');
    expect(events).toEqual(['open:first', 'open:second', 'close:second', 'close:first']);
    await server.stop();
    expect(events).toHaveLength(4);
  });

  test('boot completion runs after all services resolve without rebuilding transients', async () => {
    const events: string[] = [];
    class CompletionObserver {
      onBootComplete() { events.push('boot-complete'); }
    }
    class TransientResource {
      onInit() { events.push('open'); }
      onDestroy() { events.push('close'); }
    }
    decorateClass(CompletionObserver, Service());
    decorateClass(TransientResource, Injectable(Scope.TRANSIENT), Service());

    const server = track(new Server({ isolated: true, silent: true }).load(CompletionObserver, TransientResource));
    await server.init();
    expect(events).toEqual(['open', 'boot-complete']);
    await server.stop();
    expect(events).toEqual(['open', 'boot-complete', 'close']);
  });

  test('shutdown rejects new fetches while hooks run and concurrent stops wait for cleanup', async () => {
    let entered!: () => void;
    const teardownEntered = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const teardownGate = new Promise<void>((resolve) => { release = resolve; });
    let destroyCount = 0;
    let handlerCount = 0;

    class ClosingResource {
      async onDestroy() {
        destroyCount++;
        entered();
        await teardownGate;
      }
    }
    class PingController {
      ping() { handlerCount++; return { ok: true }; }
    }
    decorateClass(ClosingResource, Service());
    decorateMethod(PingController.prototype, 'ping', Get('/'));
    decorateClass(PingController, Controller('/closing'));

    const server = track(new Server({ isolated: true, silent: true }).load(PingController, ClosingResource));
    await server.init();
    const fetch = server.fetch;
    const listenerFetch = (server as any).createFetchHandler();
    const queuedFetch = fetch(new Request('http://localhost/closing'));
    const stopping = server.stop();
    let secondStopFinished = false;
    const secondStop = server.stop().then(() => { secondStopFinished = true; });

    try {
      await expect(queuedFetch).rejects.toThrow('Server is stopping');
      await teardownEntered;
      await expect(fetch(new Request('http://localhost/closing'))).rejects.toThrow('Server is stopping');
      await expect(server.fetch(new Request('http://localhost/closing'))).rejects.toThrow('Server is stopping');
      await expect(server.init()).rejects.toThrow('Server is stopping');
      const response = await listenerFetch(new Request('http://localhost/closing'));
      expect(response.status).toBe(500);
      expect((await response.json()).message).toContain('Server is stopping');
      expect(secondStopFinished).toBe(false);
      expect(handlerCount).toBe(0);
      expect(destroyCount).toBe(1);
    } finally {
      release();
      await Promise.all([stopping, secondStop]);
    }

    expect(secondStopFinished).toBe(true);
    await expect(fetch(new Request('http://localhost/closing'))).rejects.toThrow('Server was stopped');
  });

  test('shutdown lets an existing request drain before destroying its resources', async () => {
    let entered!: () => void;
    const handlerEntered = new Promise<void>((resolve) => { entered = resolve; });
    let release!: () => void;
    const handlerGate = new Promise<void>((resolve) => { release = resolve; });
    let destroyed = false;

    class Resource {
      onDestroy() { destroyed = true; }
    }
    class SlowController {
      async read() {
        entered();
        await handlerGate;
        return { destroyed };
      }
    }
    decorateClass(Resource, Service());
    decorateMethod(SlowController.prototype, 'read', Get('/'));
    decorateClass(SlowController, Controller('/draining'));

    const server = track(new Server({ isolated: true, silent: true, shutdownTimeout: 1_000 })
      .load(Resource, SlowController));
    const request = server.fetch(new Request('http://localhost/draining'));
    await handlerEntered;
    const stopping = server.stop();
    try {
      await expect(server.fetch(new Request('http://localhost/draining'))).rejects.toThrow('Server is stopping');
      expect(destroyed).toBe(false);
    } finally {
      release();
    }
    expect(await (await request).json()).toEqual({ destroyed: false });
    await stopping;
    expect(destroyed).toBe(true);
  });

  test('one failing onDestroy does not skip the rest and the server still stops', async () => {
    const destroyed: string[] = [];

    class First {
      onDestroy() { destroyed.push('first'); }
    }
    decorateClass(First, Service(), Meta({ layer: 'plugin', order: 1 }));

    class Exploding {
      onDestroy() { throw new Error('destroy exploded'); }
    }
    decorateClass(Exploding, Service(), Meta({ layer: 'plugin', order: 2 }));

    class AppResource {
      onDestroy() { destroyed.push('app'); }
    }
    decorateClass(AppResource, Service());

    const server = new Server({ isolated: true, silent: true })
      .use(plugin('first').services(First).build())
      .use(plugin('exploding').services(Exploding).build())
      .load(AppResource);

    await server.init();
    const fetch = server.fetch;

    await expect(server.stop()).rejects.toThrow('destroy exploded');
    expect(destroyed).toEqual(['app', 'first']);
    await expect(fetch(new Request('http://localhost/'))).rejects.toThrow('Server was stopped');
  });

  test('defaulted decorated parameters still read the request', async () => {
    class SearchController {
      show(q = 'fallback') {
        return { q };
      }
    }
    decorateParam(SearchController.prototype, 'show', 0, Query('q'));
    decorateMethod(SearchController.prototype, 'show', Get('/show'));
    decorateClass(SearchController, Controller('/search'));

    const server = track(new Server({ isolated: true, silent: true }).load(SearchController));

    const response = await server.fetch(new Request('http://localhost/search/show?q=actual'));
    expect(await response.json()).toEqual({ q: 'actual' });
  });
});
