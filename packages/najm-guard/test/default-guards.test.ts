import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { Controller, Get, Server, Service } from 'najm-core';
import { createGuard, guards, Public } from '../src';

describe('default guards', () => {
  test('guards forgotten routes while allowing explicit guards and @Public routes', async () => {
    @Service()
    class DenyGuard { canActivate() { return false; } }
    @Service()
    class AllowGuard { canActivate() { return true; } }
    const Deny = createGuard(DenyGuard);
    const Allow = createGuard(AllowGuard);

    @Controller('/guard-default')
    class DemoController {
      @Get('/forgotten') forgotten() { return { ok: true }; }
      @Get('/explicit') @Allow() explicit() { return { ok: true }; }
      @Get('/public') @Public() publicRoute() { return { ok: true }; }
    }

    @Controller('/guard-explicit')
    @Deny()
    class ExplicitController {
      @Get('/public-marker') @Public() markedPublic() { return { ok: true }; }
    }

    const server = new Server({ isolated: true, silent: true })
      .use(guards({ default: [Deny()] }))
      .load(DenyGuard, AllowGuard, DemoController, ExplicitController);
    try {
      await server.init();
      const request = (path: string) => server.fetch(new Request(`http://local/guard-default/${path}`));
      expect((await request('forgotten')).status).toBe(401);
      expect((await request('explicit')).status).toBe(200);
      expect((await request('public')).status).toBe(200);
      expect((await server.fetch(new Request('http://local/guard-explicit/public-marker'))).status).toBe(401);
    } finally {
      await server.stop();
    }
  });
});
