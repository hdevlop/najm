import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, GuardParams, Params, Post, Get, Put, Delete, Server, Service } from 'najm-core';
import { createGuard } from 'najm-guard';
import { z } from 'zod';
import {
  Annotations,
  McpErrorCode,
  McpException,
  McpError,
  McpResult,
  McpText,
  McpJson,
  McpTool,
  ToolGroup,
  mcp,
} from '../src';
import { Validate } from 'najm-validation';

let server: Server | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

describe('najm-mcp integration', () => {
  test('registers controller @McpTool methods and splits flat MCP input into params and body', async () => {
    const shipOrderSchema = {
      params: z.object({ orderId: z.string().min(1) }),
      body: z.object({
        trackingNumber: z.string().min(1),
        note: z.string().optional(),
      }),
    };

    @Controller('/orders')
    class OrdersController {
      @Post('/:orderId/ship')
      @McpTool('Ship an order')
      @Validate(shipOrderSchema)
      shipOrder(
        @Params('orderId') orderId: string,
        @Body('trackingNumber') trackingNumber: string,
        @Body() body: { trackingNumber: string; note?: string },
      ) {
        return {
          orderId,
          trackingNumber,
          note: body.note ?? null,
        };
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-controller-tools',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(OrdersController)
      .listen(5151);

    const discovery = await fetch('http://localhost:5151/mcp/tools');
    expect(discovery.status).toBe(200);
    const discoveryBody = await discovery.json();
    const tool = discoveryBody.tools.find((entry: any) => entry.name === 'ship_order');

    expect(tool).toBeDefined();
    expect(tool.args).toEqual(['orderId', 'trackingNumber', 'note']);

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:5151/mcp'));

    await client.connect(transport);

    const result = await client.callTool({
      name: 'ship_order',
      arguments: {
        orderId: 'ord_123',
        trackingNumber: 'trk_456',
        note: 'fragile',
      },
    });

    expect(result.content?.[0]?.type).toBe('text');
    expect(JSON.parse(result.content?.[0]?.text ?? '{}')).toEqual({
      orderId: 'ord_123',
      trackingNumber: 'trk_456',
      note: 'fragile',
    });

    await transport.close();
  });

  test('reuses class guards for controller MCP tools', async () => {
    @Service()
    class ModeGuard {
      canActivate(@GuardParams() mode: string): boolean {
        return mode === 'allow';
      }
    }

    const AllowedOrder = createGuard<string>(ModeGuard);

    @Controller('/orders')
    class SecureOrdersController {
      @Post('/:orderId/approve')
      @McpTool('Approve an order')
      @AllowedOrder('allow')
      @Validate({
        params: z.object({ orderId: z.string().min(1) }),
        body: z.object({ reason: z.string().default('approved') }),
      })
      approveOrder(
        @Params('orderId') orderId: string,
        @Body('reason') reason: string,
      ) {
        return { orderId, reason, status: 'approved' };
      }

      @Post('/:orderId/reject')
      @McpTool('Reject an order')
      @AllowedOrder('deny')
      @Validate({
        params: z.object({ orderId: z.string().min(1) }),
        body: z.object({ reason: z.string().default('rejected') }),
      })
      rejectOrder(
        @Params('orderId') orderId: string,
        @Body('reason') reason: string,
      ) {
        return { orderId, reason, status: 'rejected' };
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-controller-guards',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(ModeGuard, SecureOrdersController)
      .listen(5152);

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const adminClient = new Client({ name: 'admin-client', version: '1.0.0' });
    const adminTransport = new StreamableHTTPClientTransport(new URL('http://localhost:5152/mcp'));

    await adminClient.connect(adminTransport);

    const approved = await adminClient.callTool({
      name: 'approve_order',
      arguments: {
        orderId: 'ord_789',
        reason: 'verified',
      },
    });

    expect(approved.content?.[0]?.type).toBe('text');
    expect(JSON.parse(approved.content?.[0]?.text ?? '{}')).toEqual({
      orderId: 'ord_789',
      reason: 'verified',
      status: 'approved',
    });

    await adminTransport.close();

    const userClient = new Client({ name: 'user-client', version: '1.0.0' });
    const userTransport = new StreamableHTTPClientTransport(new URL('http://localhost:5152/mcp'));

    await userClient.connect(userTransport);

    const denied = await userClient.callTool({
      name: 'reject_order',
      arguments: {
        orderId: 'bad_789',
      },
    });

    expect(denied.isError).toBe(true);
    expect(denied.content?.[0]?.text).toBe('Error (FORBIDDEN): Access denied for tool: SecureOrdersController.rejectOrder');

    await userTransport.close();
  });

  test('supports @ToolGroup prefix on controller tools', async () => {
    @ToolGroup('products')
    @Controller('/products')
    class ProductsController {
      @Get('/')
      @McpTool('List all products')
      @Validate(z.object({}))
      getAll() {
        return [{ id: '1', name: 'Widget' }];
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-grouped',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(ProductsController)
      .listen(5153);

    const discovery = await fetch('http://localhost:5153/mcp/tools');
    expect(discovery.status).toBe(200);
    const body = await discovery.json();

    expect(body.tools.some((tool: any) => tool.name === 'products_get_all')).toBe(true);
  });

  test('B1 naming: products_get and products_get_by_id from method names', async () => {
    @ToolGroup('products')
    @Controller('/products')
    class ProductsController {
      @Get('/')
      @McpTool({ description: 'List all products', readOnly: true })
      @Validate(z.object({}))
      getAll() {
        return [];
      }

      @Post('/resolve')
      @McpTool({ description: 'Get a product by query', readOnly: true })
      @Validate(z.object({ product: z.string().min(1) }))
      get(@Body('product') _q: string) {
        return {};
      }

      @Get('/:id')
      @McpTool({ description: 'Get a product by ID', readOnly: true })
      @Validate({ params: z.object({ id: z.string() }) })
      getById(@Params('id') _id: string) {
        return {};
      }

      @Post('/actions/update')
      @McpTool({
        description: 'Update a product by query',
        confirm: { level: 'warning', message: 'confirm.products.update' },
      })
      @Validate(z.object({ product: z.string().min(1), name: z.string().optional() }))
      update(@Body() _body: any) {
        return {};
      }

      @Put('/:id')
      @McpTool({
        description: 'Update a product by ID',
        confirm: { level: 'warning', message: 'confirm.products.update' },
      })
      @Validate({ params: z.object({ id: z.string() }), body: z.object({ name: z.string().optional() }) })
      updateById(@Params('id') _id: string, @Body() _body: any) {
        return {};
      }

      @Post('/actions/delete')
      @McpTool({
        description: 'Delete a product by query',
        confirm: { level: 'danger', message: 'confirm.products.delete' },
      })
      @Validate(z.object({ product: z.string().min(1) }))
      delete(@Body() _body: any) {
        return {};
      }

      @Delete('/:id')
      @McpTool({
        description: 'Delete a product by ID',
        confirm: { level: 'danger', message: 'confirm.products.delete' },
      })
      @Validate({ params: z.object({ id: z.string() }) })
      deleteById(@Params('id') _id: string) {
        return {};
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-b1-naming',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(ProductsController)
      .listen(5161);

    const discovery = await fetch('http://localhost:5161/mcp/tools');
    expect(discovery.status).toBe(200);
    const body = await discovery.json();
    const names = body.tools.map((t: any) => t.name);

    expect(names).toContain('products_get_all');
    expect(names).toContain('products_get');
    expect(names).toContain('products_get_by_id');
    expect(names).toContain('products_update');
    expect(names).toContain('products_update_by_id');
    expect(names).toContain('products_delete');
    expect(names).toContain('products_delete_by_id');

    const getTool = body.tools.find((t: any) => t.name === 'products_get');
    expect(getTool.annotations.readOnlyHint).toBe(true);

    const updateTool = body.tools.find((t: any) => t.name === 'products_update');
    expect(updateTool.confirmation).toEqual({ level: 'warning', message: 'confirm.products.update' });

    const deleteTool = body.tools.find((t: any) => t.name === 'products_delete');
    expect(deleteTool.confirmation).toEqual({ level: 'danger', message: 'confirm.products.delete' });

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const client = new Client({ name: 'b1-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:5161/mcp'));
    await client.connect(transport);

    const deleteResult = await client.callTool({
      name: 'products_delete',
      arguments: { product: 'TempTestProduct_B1_Verify' },
    });

    expect(deleteResult.isError).toBeUndefined();
    await transport.close();
  });

  test('discovery endpoint includes group, localName, and annotations', async () => {
    @Controller('/items')
    class AnnotatedController {
      @Post('/delete')
      @McpTool({
        description: 'Delete an item',
        confirm: { level: 'danger', message: 'items.confirm.delete' },
      })
      @Annotations({ destructive: true, readOnlyHint: false })
      @Validate(z.object({ id: z.string() }))
      deleteItem(@Body('id') id: string) {
        return { deleted: id };
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-annotated',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(AnnotatedController)
      .listen(5160);

    const discovery = await fetch('http://localhost:5160/mcp/tools');
    expect(discovery.status).toBe(200);
    const body = await discovery.json();

    const tool = body.tools.find((t: any) => t.name === 'delete_item');
    expect(tool).toBeDefined();
    expect(tool.localName).toBe('delete_item');
    expect(tool.annotations).toEqual({ destructive: true, readOnlyHint: false });
    expect(tool.confirmation).toEqual({ level: 'danger', message: 'items.confirm.delete' });
  });

  test('applies auth middleware on MCP root route', async () => {
    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-auth',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
        auth: {
          type: 'bearer',
          validate: (token) => token === 'secret-token',
        },
      }))
      .listen(5154);

    const denied = await fetch('http://localhost:5154/mcp');
    expect(denied.status).toBe(401);

    const allowed = await fetch('http://localhost:5154/mcp', {
      headers: {
        Authorization: 'Bearer secret-token',
      },
    });

    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.name).toBe('mcp-auth');
  });

  test('returns CORS headers and 204 for OPTIONS preflight', async () => {
    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-cors',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
        cors: true,
      }))
      .listen(5155);

    const response = await fetch('http://localhost:5155/mcp', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  test('allows unauthenticated OPTIONS preflight when auth and CORS are both enabled', async () => {
    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-auth-cors',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
        cors: true,
        auth: {
          type: 'bearer',
          validate: (token) => token === 'secret-token',
        },
      }))
      .listen(5156);

    const preflight = await fetch('http://localhost:5156/mcp', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const denied = await fetch('http://localhost:5156/mcp');
    expect(denied.status).toBe(401);
  });

  test('filters stdio from HTTP probe transports', async () => {
    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-mixed-transports',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http', 'sse', 'stdio'],
      }))
      .listen(5157);

    const probe = await fetch('http://localhost:5157/mcp');
    expect(probe.status).toBe(200);

    const body = await probe.json();
    expect(body.transports).toEqual(['http', 'sse']);
    expect(body.transports.includes('stdio')).toBe(false);
  });

  test('serializes undefined tool results as OK text', async () => {
    @Controller('/noop')
    class NoopController {
      @Get('/')
      @McpTool('Do nothing')
      run() {
        return undefined;
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-undefined',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(NoopController)
      .listen(5158);

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:5158/mcp'));

    await client.connect(transport);

    const result = await client.callTool({ name: 'run' });
    const first = result.content?.[0];

    expect(first?.type).toBe('text');
    expect(first?.text).toBe('OK');

    await transport.close();
  });

  test('supports catchErrors fallback and preserves semantic errors', async () => {
    @Controller('/errors')
    class ErrorController {
      @Get('/fallback')
      @McpTool('Fallback error test')
      fallbackError() {
        throw new Error('backend is down');
      }

      @Get('/semantic')
      @McpTool('Semantic error test')
      semanticError() {
        throw new McpException('Order not found', McpErrorCode.NOT_FOUND);
      }

      @Get('/explicit-error')
      @McpTool('Explicit error payload')
      explicitErrorPayload() {
        return McpError('Validation failed', { field: 'bookId' });
      }

      @Get('/explicit-success')
      @McpTool('Explicit success payload')
      explicitSuccessPayload() {
        return McpResult({ ok: true, source: 'helper' });
      }
    }

    server = await new Server({ isolated: true })
      .use(mcp({
        name: 'mcp-errors',
        version: '1.0.0',
        path: '/mcp',
        transports: ['http'],
      }))
      .load(ErrorController)
      .listen(5159);

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:5159/mcp'));

    await client.connect(transport);

    const semanticError = await client.callTool({ name: 'semantic_error' });
    expect(semanticError.isError).toBe(true);
    expect(semanticError.content?.[0]?.text).toBe('Error (NOT_FOUND): Order not found');

    const explicitError = await client.callTool({ name: 'explicit_error_payload' });
    expect(explicitError.isError).toBe(true);
    expect(JSON.parse(explicitError.content?.[0]?.text ?? '{}')).toEqual({
      error: 'Validation failed',
      field: 'bookId',
    });

    const explicitSuccess = await client.callTool({ name: 'explicit_success_payload' });
    expect(explicitSuccess.isError).toBeUndefined();
    expect(JSON.parse(explicitSuccess.content?.[0]?.text ?? '{}')).toEqual({
      ok: true,
      source: 'helper',
    });

    await transport.close();
  });
});
