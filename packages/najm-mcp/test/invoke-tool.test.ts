import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, Params, Post, Server, Service, User } from 'najm-core';
import { createGuard } from 'najm-guard';
import { USER } from 'najm-guard';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { McpTool, mcp } from '../src';
import { McpBuilderService } from '../src/McpBuilderService';

let server: Server | undefined;
let port = 5250;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function bootWith(...classes: any[]): Promise<{ server: Server; builder: McpBuilderService }> {
  server = await new Server({ isolated: true })
    .use(mcp({
      name: 'invoke-tool-test',
      version: '1.0.0',
      path: '/mcp',
      transports: ['http'],
    }))
    .load(...classes)
    .listen(port++);
  const builder = (server as any).container.get(McpBuilderService) as McpBuilderService;
  return { server, builder };
}

describe('McpBuilderService.invokeTool (in-process)', () => {
  test('happy path: invokes a registered tool and returns the result', async () => {
    @Controller('/orders')
    class OrdersController {
      @Post('/:orderId/ship')
      @McpTool('Ship an order')
      @Validate({
        params: z.object({ orderId: z.string().min(1) }),
        body: z.object({ tracking: z.string().min(1) }),
      })
      shipOrder(@Params('orderId') orderId: string, @Body('tracking') tracking: string) {
        return { orderId, tracking, status: 'shipped' };
      }
    }

    const { builder } = await bootWith(OrdersController);

    const result = await builder.invokeTool('ship_order', { orderId: 'ord_1', tracking: 'trk_1' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({
      orderId: 'ord_1',
      tracking: 'trk_1',
      status: 'shipped',
    });
  });

  test('validation failure: bad input returns isError without calling the method', async () => {
    let called = false;

    @Controller('/items')
    class ItemsController {
      @Post('/')
      @McpTool('Create an item')
      @Validate({ body: z.object({ name: z.string().min(3) }) })
      create(@Body('name') name: string) {
        called = true;
        return { name };
      }
    }

    const { builder } = await bootWith(ItemsController);

    const result = await builder.invokeTool('create', { name: 'a' });

    expect(result.isError).toBe(true);
    expect(called).toBe(false);
  });

  test('guard rejection: blocked guard produces FORBIDDEN error', async () => {
    @Service()
    class DenyGuard {
      canActivate(): boolean {
        return false;
      }
    }

    const Denied = createGuard(DenyGuard);

    @Controller('/secure')
    class SecureController {
      @Post('/act')
      @McpTool('Guarded action')
      @Denied()
      @Validate({ body: z.object({}).optional() })
      act() {
        return { ran: true };
      }
    }

    const { builder } = await bootWith(DenyGuard, SecureController);

    const result = await builder.invokeTool('act', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FORBIDDEN');
  });

  test('ALS propagation: @User resolves from the caller-set USER token', async () => {
    @Controller('/me')
    class MeController {
      @Post('/whoami')
      @McpTool('Return the current user id')
      @Validate({ body: z.object({}).optional() })
      whoami(@User('id') userId: string) {
        return { userId };
      }
    }

    const { server: s, builder } = await bootWith(MeController);

    const container = (s as any).container;
    const result = await container.run({ [USER.key]: { id: 'user_42', email: 'x@y.z' } }, async () => {
      return builder.invokeTool('whoami', {});
    });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ userId: 'user_42' });
  });
});
