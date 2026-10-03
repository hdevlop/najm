import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Controller, Get, Injectable, Meta, REQUEST_ID, Scope, Server, Service, plugin } from '../dist/index.mjs';

function gate() {
   let release!: () => void;
   const promise = new Promise<void>((resolve) => { release = resolve; });
   return { promise, release };
}

function service(target: Function, scope = Scope.SINGLETON) {
   Service()(target);
   Injectable(scope)(target);
}

function controller(target: Function, path: string, scope = Scope.SINGLETON) {
   Controller(path)(target);
   Injectable(scope)(target);
   Get('/')(target.prototype, 'read', Object.getOwnPropertyDescriptor(target.prototype, 'read')!);
}

const servers: Server[] = [];
function track(server: Server) { servers.push(server); return server; }

afterEach(async () => {
   while (servers.length) await servers.pop()!.stop().catch(() => {});
});

describe('startup coordination', () => {
   test.each(['init', 'listen'] as const)('stop waits for an in-progress %s and prevents serving afterwards', async (method) => {
      const entered = gate();
      const resume = gate();
      let destroyed = 0;
      class Resource {
         async activate() { entered.release(); await resume.promise; }
         onDestroy() { destroyed++; }
      }
      service(Resource);
      Meta({ layer: 'plugin' })(Resource);
      const server = track(new Server({ isolated: true, silent: true })
         .use(plugin('slow-start').services(Resource).build()));
      const starting = (method === 'init' ? server.init() : server.listen(0))
         .then(() => undefined, (error) => error);
      await entered.promise;
      let finished = false;
      const stopping = server.stop().then(() => { finished = true; });
      const secondStop = server.stop();
      try {
         await Promise.resolve();
         expect(finished).toBe(false);
         await expect(server.fetch(new Request('http://localhost/'))).rejects.toThrow('Server is stopping');
      } finally {
         resume.release();
         await Promise.all([stopping, secondStop]);
      }
      expect((await starting).message).toContain('Server is stopping');
      expect(destroyed).toBe(1);
      expect(server.isRunning).toBe(false);
      await expect(server.init()).rejects.toThrow('Server was stopped');
   });

   test('failed initialization racing stop rolls back once and settles shutdown', async () => {
      const entered = gate();
      const resume = gate();
      let destroyed = 0;
      class Resource {
         async activate() { entered.release(); await resume.promise; throw new Error('boot failed'); }
         onDestroy() { destroyed++; }
      }
      service(Resource);
      Meta({ layer: 'plugin' })(Resource);
      const server = track(new Server({ isolated: true, silent: true })
         .use(plugin('failed-start').services(Resource).build()));
      const starting = server.init().catch((error) => error);
      await entered.promise;
      const stopping = server.stop();
      resume.release();
      await stopping;
      expect((await starting).message).toContain('boot failed');
      expect(destroyed).toBe(1);
      await expect(server.init()).rejects.toThrow('Server was stopped');
   });

   test('concurrent listen calls start only one listener', async () => {
      const server = track(new Server({ isolated: true, silent: true }));
      const results = await Promise.allSettled([server.listen(0), server.listen(0)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason.message).toContain('already starting');
      const port = server.port!;
      await server.stop();
      // Binding the exact port again proves the original listener was closed.
      const next = track(new Server({ isolated: true, silent: true }));
      await next.listen(port);
      expect(next.port).toBe(port);
   });

   test('stop racing listener creation leaves no open listener', async () => {
      const server = track(new Server({ isolated: true, silent: true }));
      await server.init();
      const originalFetchHandler = (server as any).createFetchHandler.bind(server);
      let stopping!: Promise<void>;
      // This boundary is immediately before the actual runtime listener binds.
      (server as any).createFetchHandler = () => {
         stopping = server.stop();
         return originalFetchHandler();
      };
      await expect(server.listen(0)).rejects.toThrow('Server is stopping');
      await stopping;
      expect(server.isRunning).toBe(false);
      expect(server.port).toBeUndefined();
   });
});

describe('owned provider teardown', () => {
   test('cleans alias targets and deduplicates repeated resolutions', async () => {
      let opened = 0;
      let destroyed = 0;
      class Resource { onInit() { opened++; } onDestroy() { destroyed++; } }
      service(Resource);
      const token = Symbol('resource');
      const server = track(new Server({ isolated: true, silent: true })
         .use(plugin('aliased').services(Resource).alias(token, Resource).build()));
      await server.init();
      await server.container.resolve(token);
      await server.container.resolve(Resource);
      await server.stop();
      expect(opened).toBe(1);
      expect(destroyed).toBe(1);
   });

   test('cleans lazy plugin providers resolved by a request', async () => {
      let opened = 0;
      let destroyed = 0;
      class Resource { onInit() { opened++; } onDestroy() { destroyed++; } }
      service(Resource);
      class Consumer {
         constructor(private resource: Resource) {}
         read() { return { ok: !!this.resource }; }
      }
      Reflect.defineMetadata('design:paramtypes', [Resource], Consumer);
      controller(Consumer, '/lazy');
      const server = track(new Server({ isolated: true, silent: true })
         .use(plugin('lazy').services(Resource, Consumer).build()));
      await server.init();
      expect(opened).toBe(0);
      expect(await (await server.fetch(new Request('http://localhost/lazy'))).json()).toEqual({ ok: true });
      await server.stop();
      expect(opened).toBe(1);
      expect(destroyed).toBe(1);
   });

   test('failed consumers still clean their successfully initialized dependencies', async () => {
      let opened = 0;
      let destroyed = 0;
      class Dependency { onInit() { opened++; } onDestroy() { destroyed++; } }
      class Consumer {
         constructor(private dependency: Dependency) {}
         onInit() { throw new Error('consumer failed'); }
      }
      service(Dependency);
      service(Consumer);
      Reflect.defineMetadata('design:paramtypes', [Dependency], Consumer);
      const server = track(new Server({ isolated: true, silent: true }).load(Consumer, Dependency));
      await expect(server.init()).rejects.toThrow('consumer failed');
      expect(opened).toBe(1);
      expect(destroyed).toBe(1);
   });

   test.each(['constructor', 'onInit'] as const)('destroys consumers before dependencies resolved through %s', async (kind) => {
      const events: string[] = [];
      class Dependency {
         closed = false;
         onInit() { events.push('open:dependency'); }
         onDestroy() { this.closed = true; events.push('close:dependency'); }
      }
      class Consumer {
         constructor(private dependency?: Dependency) {}
         async onInit() {
            this.dependency ??= await server.container.resolve(Dependency);
            events.push('open:consumer');
         }
         onDestroy() {
            expect(this.dependency!.closed).toBe(false);
            events.push('close:consumer');
         }
      }
      service(Dependency);
      service(Consumer);
      if (kind === 'constructor') Reflect.defineMetadata('design:paramtypes', [Dependency], Consumer);
      const server = track(new Server({ isolated: true, silent: true }).load(Consumer, Dependency));
      await server.init();
      await server.stop();
      expect(events).toEqual(['open:dependency', 'open:consumer', 'close:consumer', 'close:dependency']);
   });

   test('cleans factory-created providers but preserves caller-owned token values', async () => {
      let factoryDestroyed = 0;
      let callerDestroyed = 0;
      class Resource { onDestroy() { callerDestroyed++; } }
      service(Resource);
      const token = Symbol('factory');
      const callerToken = Symbol('caller');
      const server = track(new Server({ isolated: true, silent: true })
         .use(plugin('resources').services(Resource).build()));
      server.container.set(token, () => ({ onDestroy() { factoryDestroyed++; } }));
      server.container.set(callerToken, new Resource());
      await server.init();
      await server.container.resolve(token);
      await server.container.resolve(callerToken);
      await server.stop();
      expect(factoryDestroyed).toBe(1);
      expect(callerDestroyed).toBe(0);
   });

   test('cleans transient dependencies as well as explicitly booted instances', async () => {
      let opened = 0;
      let destroyed = 0;
      class Dependency { onInit() { opened++; } onDestroy() { destroyed++; } }
      class Consumer { constructor(private dependency: Dependency) {} }
      service(Dependency, Scope.TRANSIENT);
      service(Consumer);
      Reflect.defineMetadata('design:paramtypes', [Dependency], Consumer);
      const server = track(new Server({ isolated: true, silent: true }).load(Consumer, Dependency));
      await server.init();
      await server.stop();
      expect(opened).toBe(2);
      expect(destroyed).toBe(2);
   });
});

describe('streaming request lifetime', () => {
   test('a socket disconnect cancels its streamed source and cleans request resources once', async () => {
      let destroyed = 0;
      let cancelled = 0;
      const cleanupDone = gate();
      class Resource { onDestroy() { destroyed++; cleanupDone.release(); } }
      Injectable(Scope.REQUEST)(Resource);
      class StreamController {
         constructor(private resource: Resource) {}
         read() {
            return new Response(new ReadableStream({
               start(value) { value.enqueue(new TextEncoder().encode('partial')); },
               cancel() { cancelled++; },
            }));
         }
      }
      Reflect.defineMetadata('design:paramtypes', [Resource], StreamController);
      controller(StreamController, '/socket-stream', Scope.REQUEST);
      const server = track(new Server({ isolated: true, silent: true }).load(Resource, StreamController));
      await server.listen(0);
      const client = new AbortController();
      const response = await fetch(`http://localhost:${server.port}/socket-stream`, { signal: client.signal });
      const reader = response.body!.getReader();
      const closed = reader.closed.catch((error) => error);
      try {
         expect(new TextDecoder().decode((await reader.read()).value)).toBe('partial');
      } finally {
         client.abort();
      }
      await cleanupDone.promise;
      expect((await closed).name).toBe('AbortError');
      // Let the transport finish disconnecting; an unhandled server-side
      // response-reader rejection would fail this test under the Bun runner.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(cancelled).toBe(1);
      expect(destroyed).toBe(1);
      expect(server.container.requestScoped.size).toBe(0);
      await server.stop();
      expect(destroyed).toBe(1);
   });

   test.each(['raw response', 'stream'] as const)('keeps request resources and ALS alive while a %s is consumed', async (kind) => {
      const resume = gate();
      let destroyed = 0;
      let scopeId: string | undefined;
      class Resource {
         closed = false;
         read() { expect(this.closed).toBe(false); return 'stream-data'; }
         onDestroy() { this.closed = true; destroyed++; }
      }
      Injectable(Scope.REQUEST)(Resource);
      class StreamController {
         constructor(private resource: Resource) {}
         read() {
            scopeId = server.container.get(REQUEST_ID);
            const resource = this.resource;
            const body = new ReadableStream<Uint8Array>({
               async pull(value) {
                  await resume.promise;
                  expect(server.container.get(REQUEST_ID)).toBe(scopeId);
                  value.enqueue(new TextEncoder().encode(resource.read()));
                  value.close();
               },
            }, { highWaterMark: 0 });
            return kind === 'stream' ? body : new Response(body, { status: 202, headers: { 'x-stream': 'yes' } });
         }
      }
      Reflect.defineMetadata('design:paramtypes', [Resource], StreamController);
      controller(StreamController, '/stream', Scope.REQUEST);
      const server = track(new Server({ isolated: true, silent: true }).load(Resource, StreamController));
      const response = await server.fetch(new Request('http://localhost/stream'));
      expect(destroyed).toBe(0);
      expect(server.container.hasRequestScope(scopeId)).toBe(true);
      expect(response.headers.get('x-request-id')).toBeTruthy();
      if (kind === 'raw response') {
         expect(response.status).toBe(202);
         expect(response.headers.get('x-stream')).toBe('yes');
      }
      resume.release();
      expect(await response.text()).toBe('stream-data');
      expect(destroyed).toBe(1);
      expect(server.container.hasRequestScope(scopeId)).toBe(false);
      await server.stop();
      expect(destroyed).toBe(1);
   });

   test.each(['cancel', 'error', 'abort', 'already aborted'] as const)('cleans a streamed request exactly once on %s', async (kind) => {
      let destroyed = 0;
      let cancelled = 0;
      const cleanupDone = gate();
      class Resource { onDestroy() { destroyed++; cleanupDone.release(); } }
      Injectable(Scope.REQUEST)(Resource);
      class StreamController {
         constructor(private resource: Resource) {}
         read() {
            return new Response(new ReadableStream({
               pull(value) { if (kind === 'error') value.error(new Error('stream failed')); },
               cancel() { cancelled++; },
            }, { highWaterMark: 0 }));
         }
      }
      Reflect.defineMetadata('design:paramtypes', [Resource], StreamController);
      controller(StreamController, '/stream-end', Scope.REQUEST);
      const server = track(new Server({ isolated: true, silent: true }).load(Resource, StreamController));
      const abort = new AbortController();
      if (kind === 'already aborted') abort.abort(new Error('client left'));
      const response = await server.fetch(new Request('http://localhost/stream-end', { signal: abort.signal }));
      if (kind !== 'already aborted') expect(destroyed).toBe(0);
      if (kind === 'cancel') await response.body!.cancel();
      if (kind === 'error') await expect(response.text()).rejects.toThrow('stream failed');
      if (kind === 'abort' || kind === 'already aborted') {
         if (kind === 'abort') abort.abort(new Error('client left'));
         await expect(response.text()).rejects.toThrow('client left');
         await cleanupDone.promise;
      }
      expect(destroyed).toBe(1);
      expect(server.container.requestScoped.size).toBe(0);
      if (kind !== 'error') expect(cancelled).toBe(1);
      await server.stop();
      expect(destroyed).toBe(1);
   });

   test.each(['json', 'stream'] as const)('shutdown drains the %s response and request cleanup before destroying shared resources', async (kind) => {
      const resume = gate();
      const entered = gate();
      const cleanupEntered = gate();
      const cleanupResume = gate();
      const events: string[] = [];
      class SharedResource {
         closed = false;
         onDestroy() { this.closed = true; events.push('shared'); }
      }
      service(SharedResource);
      class RequestResource {
         constructor(private shared: SharedResource) {}
         async onDestroy() {
            cleanupEntered.release();
            await cleanupResume.promise;
            expect(this.shared.closed).toBe(false);
            events.push('request');
         }
      }
      Reflect.defineMetadata('design:paramtypes', [SharedResource], RequestResource);
      Injectable(Scope.REQUEST)(RequestResource);
      class StreamController {
         constructor(private resource: RequestResource) {}
         async read() {
            entered.release();
            if (kind === 'json') {
               await resume.promise;
               return { ok: true };
            }
            return new ReadableStream({
               async pull(value) { await resume.promise; value.enqueue(new TextEncoder().encode('done')); value.close(); },
            }, { highWaterMark: 0 });
         }
      }
      Reflect.defineMetadata('design:paramtypes', [RequestResource], StreamController);
      controller(StreamController, '/stream-drain', Scope.REQUEST);
      const server = track(new Server({ isolated: true, silent: true, shutdownTimeout: 1_000 })
         .load(SharedResource, RequestResource, StreamController));
      const fetching = server.fetch(new Request('http://localhost/stream-drain'));
      await entered.promise;
      if (kind === 'stream') await fetching;
      let stopped = false;
      const stopping = server.stop().then(() => { stopped = true; });
      try {
         await Promise.resolve();
         expect(stopped).toBe(false);
         expect(events).toEqual([]);
      } finally {
         resume.release();
         const reading = fetching.then((response) => response.text());
         await cleanupEntered.promise;
         expect(stopped).toBe(false);
         expect(events).toEqual([]);
         cleanupResume.release();
         expect(await reading).toBe(kind === 'stream' ? 'done' : '{"ok":true}');
         await stopping;
      }
      expect(events).toEqual(['request', 'shared']);
   });
});
