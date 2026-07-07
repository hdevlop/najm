import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Params,
  Post,
  Query,
  Scope,
  Server,
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

function decorateParam(target: object, methodName: string, index: number, decorator: ParameterDecorator) {
  decorator(target, methodName, index);
}

const stoppedServers: Server[] = [];

async function initServer(...controllers: Function[]): Promise<Server> {
  const server = new Server({ isolated: true, silent: true }).load(...controllers);
  stoppedServers.push(server);
  await server.init();
  return server;
}

describe('hot path scope regressions', () => {
  afterEach(async () => {
    while (stoppedServers.length) {
      await stoppedServers.pop()?.stop();
    }
  });

  test('request-scoped controllers resolve per request', async () => {
    class RequestScopedController {
      private static nextId = 0;
      private readonly id = ++RequestScopedController.nextId;

      marker() {
        return { id: this.id };
      }
    }
    decorateMethod(RequestScopedController.prototype, 'marker', Get('/marker'));
    decorateClass(RequestScopedController, Injectable(Scope.REQUEST), Controller('/rs'));

    const server = await initServer(RequestScopedController);

    const first = await (await server.fetch(new Request('http://localhost/rs/marker'))).json() as { id: number };
    const second = await (await server.fetch(new Request('http://localhost/rs/marker'))).json() as { id: number };

    expect(first.id).not.toBe(second.id);
  });

  test('request-scoped controllers clean request cache after the response', async () => {
    class RequestScopedCleanupController {
      marker() {
        return { ok: true };
      }
    }
    decorateMethod(RequestScopedCleanupController.prototype, 'marker', Get('/marker'));
    decorateClass(RequestScopedCleanupController, Injectable(Scope.REQUEST), Controller('/rs-cleanup'));

    const server = await initServer(RequestScopedCleanupController);
    const response = await server.fetch(new Request('http://localhost/rs-cleanup/marker'));

    expect(response.status).toBe(200);
    expect(server.container.requestScoped.size).toBe(0);
    expect(server.container.requestPromises.size).toBe(0);
  });

  test('singleton controllers reuse the same instance across requests', async () => {
    class SingletonController {
      private static nextId = 0;
      private readonly id = ++SingletonController.nextId;

      marker() {
        return { id: this.id };
      }
    }
    decorateMethod(SingletonController.prototype, 'marker', Get('/marker'));
    decorateClass(SingletonController, Controller('/singleton'));

    const server = await initServer(SingletonController);

    const first = await (await server.fetch(new Request('http://localhost/singleton/marker'))).json() as { id: number };
    const second = await (await server.fetch(new Request('http://localhost/singleton/marker'))).json() as { id: number };

    expect(first.id).toBe(second.id);
  });

  test('@Body still parses JSON on optimized handlers', async () => {
    class BodyController {
      create(body: { name: string }) {
        return { name: body.name };
      }
    }
    decorateParam(BodyController.prototype, 'create', 0, Body());
    decorateMethod(BodyController.prototype, 'create', Post('/items'));
    decorateClass(BodyController, Controller('/body'));

    const server = await initServer(BodyController);
    const response = await server.fetch(new Request('http://localhost/body/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'najm' }),
    }));

    expect(await response.json()).toEqual({ name: 'najm' });
  });

  test('fully decorated sync parameters resolve without the legacy path', async () => {
    class SyncController {
      show(id: string, q: string, authorization: string) {
        return { id, q, authorization };
      }
    }
    decorateParam(SyncController.prototype, 'show', 0, Params('id'));
    decorateParam(SyncController.prototype, 'show', 1, Query('q'));
    decorateParam(SyncController.prototype, 'show', 2, Headers('authorization'));
    decorateMethod(SyncController.prototype, 'show', Get('/items/:id'));
    decorateClass(SyncController, Controller('/sync'));

    const server = await initServer(SyncController);
    const response = await server.fetch(new Request('http://localhost/sync/items/42?q=najm', {
      headers: { authorization: 'Bearer token' },
    }));

    expect(await response.json()).toEqual({
      id: '42',
      q: 'najm',
      authorization: 'Bearer token',
    });
  });

  test('mixed decorated and legacy parameters still resolve through the legacy path', async () => {
    class MixedController {
      show(id: string, ctx: any) {
        return { id, path: ctx.req.path };
      }
    }
    decorateParam(MixedController.prototype, 'show', 0, Params('id'));
    decorateMethod(MixedController.prototype, 'show', Get('/items/:id'));
    decorateClass(MixedController, Controller('/mixed'));

    const server = await initServer(MixedController);
    const response = await server.fetch(new Request('http://localhost/mixed/items/42'));

    expect(await response.json()).toEqual({ id: '42', path: '/mixed/items/42' });
  });
});
