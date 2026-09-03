import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, Get, Params, Post, Query, Server, Service, User } from 'najm-core';
import { createGuard } from 'najm-guard';
import { USER } from 'najm-guard';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { McpTool, mcp } from '../src';
import { McpBuilderService, resolveRegisteredToolInputObjectSchema } from '../src/McpBuilderService';
import { McpRegistryService } from '../src/McpRegistryService';

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

  test('unexpected tool errors are opaque unless diagnostics are explicitly enabled', async () => {
    @Controller('/failures')
    class FailureController {
      @Post('/explode')
      @McpTool('Explode')
      explode() {
        throw new Error('database-host.internal:5432');
      }
    }

    const { builder } = await bootWith(FailureController);
    const safe = await builder.invokeTool('explode', {});

    expect(safe.content[0].text).toBe('Tool execution failed');
    expect(safe.content[0].text).not.toContain('database-host');

    (builder as any).config.exposeErrorDetails = true;
    const diagnostic = await builder.invokeTool('explode', {});
    expect(diagnostic.content[0].text).toBe('database-host.internal:5432');
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
    expect(result.content[0].text).toBe('Error (FORBIDDEN): Access denied');
    expect(result.content[0].text).not.toContain('SecureController.act');

    (builder as any).config.exposeErrorDetails = true;
    const diagnostic = await builder.invokeTool('act', {});
    expect(diagnostic.content[0].text).toContain('SecureController.act');
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

describe('@Query resolution (review item #6)', () => {
  test('@Query("x") resolves from the flat MCP input', async () => {
    @Controller('/search')
    class SearchController {
      @Get('/')
      @McpTool('Search items')
      @Validate({ query: z.object({ q: z.string(), page: z.coerce.number() }) })
      search(@Query('q') q: string, @Query('page') page: number) {
        return { q, page };
      }
    }

    const { builder } = await bootWith(SearchController);

    const result = await builder.invokeTool('search', { q: 'shoes', page: 2 });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ q: 'shoes', page: 2 });
  });

  test('whole-object @Query() receives the query bucket', async () => {
    @Controller('/catalog')
    class CatalogController {
      @Get('/')
      @McpTool('List catalog')
      @Validate({ query: z.object({ q: z.string(), limit: z.coerce.number() }) })
      list(@Query() query: { q: string; limit: number }) {
        return query;
      }
    }

    const { builder } = await bootWith(CatalogController);

    const result = await builder.invokeTool('list', { q: 'x', limit: 5 });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ q: 'x', limit: 5 });
  });

  test('query and body coexist on the same tool', async () => {
    @Controller('/reviews')
    class ReviewsController {
      @Post('/')
      @McpTool('Create review with paging echo')
      @Validate({
        query: z.object({ page: z.coerce.number() }),
        body: z.object({ text: z.string().min(1) }),
      })
      create(@Query('page') page: number, @Body('text') text: string) {
        return { page, text };
      }
    }

    const { builder } = await bootWith(ReviewsController);

    const result = await builder.invokeTool('create', { page: 3, text: 'great' });

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ page: 3, text: 'great' });
  });
});

describe('Duplicate tool names (review item #7)', () => {
  test('two controllers with colliding tool names fail at boot', async () => {
    @Controller('/a')
    class AController {
      @Get('/')
      @McpTool('A list')
      list() {
        return { a: true };
      }
    }

    @Controller('/b')
    class BController {
      @Get('/')
      @McpTool('B list')
      list() {
        return { b: true };
      }
    }

    await expect(bootWith(AController, BController)).rejects.toThrow(/Duplicate MCP tool name/);
  });
});

describe('Guard fail-closed (review item #2)', () => {
  test('guarded tool is rejected when the resolver is uninitialized', async () => {
    @Service()
    class AllowGuard {
      canActivate(): boolean {
        return true;
      }
    }

    const Allowed = createGuard(AllowGuard);

    @Controller('/fc')
    class FailClosedController {
      @Post('/act')
      @McpTool('Guarded action')
      @Allowed()
      @Validate({ body: z.object({}).optional() })
      act() {
        return { ran: true };
      }
    }

    const { builder } = await bootWith(AllowGuard, FailClosedController);

    // Simulate invokeTool being reached without configure() having run.
    (builder as any).resolver = undefined;

    const result = await builder.invokeTool('act', {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('FORBIDDEN');
  });
});

describe('tools/list input schema (review item #10)', () => {
  test('advertised schema is a raw shape record, not a Zod object', async () => {
    @Controller('/widgets')
    class WidgetsController {
      @Post('/:id')
      @McpTool('Update widget')
      @Validate({
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ name: z.string().min(1) }),
      })
      update(@Params('id') id: string, @Body('name') name: string) {
        return { id, name };
      }
    }

    const { server: s } = await bootWith(WidgetsController);
    const registry = (s as any).container.get(McpRegistryService) as McpRegistryService;
    const tool = registry.tools.find((t) => t.name === 'update')!;

    const schema = resolveRegisteredToolInputObjectSchema(tool) as Record<string, any>;

    // Raw shape: a plain record of field → Zod schema (no top-level .parse()).
    expect(schema).toBeDefined();
    expect(typeof (schema as any).parse).toBe('undefined');
    expect(Object.keys(schema).sort()).toEqual(['id', 'name']);
  });
});
