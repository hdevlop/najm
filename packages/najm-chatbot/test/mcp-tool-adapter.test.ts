import 'reflect-metadata';
import { describe, test, expect, afterEach } from 'bun:test';
import { Body, Controller, Params, Post, Server, User } from 'najm-core';
import { USER } from 'najm-guard';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { mcp, McpTool, McpBuilderService, McpRegistryService, resolveRegisteredToolInputSchema } from 'najm-mcp';
import { buildAiSdkTools, schemaToZod, toolParametersSchema } from '../src/agent/McpToolAdapter';

let server: Server | undefined;
let port = 5400;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function bootWith(...classes: any[]) {
  server = await new Server({ isolated: true })
    .use(mcp({ name: 'adapter-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .load(...classes)
    .listen(++port);
  const container = (server as any).container;
  const builder = container.get(McpBuilderService) as McpBuilderService;
  const registry = container.get(McpRegistryService) as McpRegistryService;
  return { server: server!, container, builder, registry };
}

describe('McpToolAdapter', () => {
  test('schemaToZod converts basic JSON-schema property types', () => {
    const zod = schemaToZod({
      properties: {
        name: { type: 'string', description: 'n' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        tags: { type: 'array' },
        color: { type: 'string', enum: ['red', 'blue'] },
        meta: { type: 'object' },
      },
      required: ['name'],
    });
    const parsed = zod.parse({ name: 'x', age: 1, active: true, tags: [], color: 'red', meta: { a: 1 } });
    expect(parsed.name).toBe('x');
    expect(() => zod.parse({ age: 1 })).toThrow();
  });

  test('buildAiSdkTools returns a tool map whose execute() invokes the real controller method', async () => {
    let called = 0;

    @Controller('/items')
    class ItemsController {
      @Post('/:id/touch')
      @McpTool('Touch an item')
      @Validate({
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ note: z.string().min(1) }),
      })
      touch(@Params('id') id: string, @Body('note') note: string) {
        called++;
        return { id, note, touched: true };
      }
    }

    const { builder, registry } = await bootWith(ItemsController);

    const tools = buildAiSdkTools(builder, registry.tools);
    expect(tools.touch).toBeDefined();

    const text = await tools.touch.execute({ id: 'item_1', note: 'hello' });
    expect(called).toBe(1);
    expect(JSON.parse(text)).toEqual({ id: 'item_1', note: 'hello', touched: true });
  });

  test('adapter execute propagates ALS context so @User resolves', async () => {
    @Controller('/me')
    class MeController {
      @Post('/whoami')
      @McpTool('Return current user id')
      @Validate({ body: z.object({}).optional() })
      whoami(@User('id') userId: string) {
        return { userId };
      }
    }

    const { container, builder, registry } = await bootWith(MeController);

    const tools = buildAiSdkTools(builder, registry.tools);

    const text = await container.run(
      { [USER.key]: { id: 'user_99' } },
      async () => tools.whoami.execute({}),
    );

    expect(JSON.parse(text)).toEqual({ userId: 'user_99' });
  });

  test('adapter surfaces safe tool errors as text without throwing', async () => {
    @Controller('/broken')
    class BrokenController {
      @Post('/boom')
      @McpTool('Always fails')
      @Validate({ body: z.object({}).optional() })
      boom() {
        throw new Error('kaboom');
      }
    }

    const { builder, registry } = await bootWith(BrokenController);

    const tools = buildAiSdkTools(builder, registry.tools);
    const result = await tools.boom.execute({});
    expect(result).toBe('Tool execution failed');
    expect(result).not.toContain('kaboom');
  });

  test('adapter can block confirmation tools in read-only mode', async () => {
    let called = 0;

    @Controller('/items')
    class ConfirmController {
      @Post('/clear')
      @McpTool({
        description: 'Clear items',
        destructive: true,
        confirm: { level: 'danger', message: 'items.confirm.clear' },
      })
      clear() {
        called++;
        return { cleared: true };
      }
    }

    const { builder, registry } = await bootWith(ConfirmController);

    const tools = buildAiSdkTools(builder, registry.tools, {
      blockConfirmationTools: true,
      readOnlyMessage: (tool) => `blocked:${tool.name}`,
    });

    const result = await tools.clear.execute({});
    expect(result).toBe('blocked:clear');
    expect(called).toBe(0);
  });

  test('adapter still executes confirmation tools when read-only block is disabled', async () => {
    let called = 0;

    @Controller('/items')
    class ConfirmController {
      @Post('/clear')
      @McpTool({
        description: 'Clear items',
        destructive: true,
        confirm: { level: 'danger', message: 'items.confirm.clear' },
      })
      clear() {
        called++;
        return { cleared: true };
      }
    }

    const { builder, registry } = await bootWith(ConfirmController);

    const tools = buildAiSdkTools(builder, registry.tools);
    const result = await tools.clear.execute({});
    expect(JSON.parse(result)).toEqual({ cleared: true });
    expect(called).toBe(1);
  });

  test('resolveRegisteredToolInputSchema returns merged params and body shape', async () => {
    @Controller('/items')
    class SchemaController {
      @Post('/:id/update')
      @McpTool('Update an item')
      @Validate({
        params: z.object({ id: z.string() }),
        body: z.object({ name: z.string() }),
      })
      update() {
        return 'ok';
      }
    }

    const { registry } = await bootWith(SchemaController);
    const tool = registry.tools.find((t) => t.name === 'update');
    expect(tool).toBeDefined();

    const shape = resolveRegisteredToolInputSchema(tool!);
    expect(shape).toBeDefined();
    expect(Object.keys(shape!)).toContain('id');
    expect(Object.keys(shape!)).toContain('name');
  });

  test('toolParametersSchema emits explicit JSON Schema object parameters', async () => {
    @Controller('/items')
    class ParamsController {
      @Post('/:id/touch')
      @McpTool('Touch an item')
      @Validate({
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ note: z.string().min(1) }),
      })
      touch(@Params('id') id: string, @Body('note') note: string) {
        return { id, note };
      }
    }

    const { builder, registry } = await bootWith(ParamsController);
    const tool = registry.tools.find((t) => t.name === 'touch')!;
    expect((toolParametersSchema(tool) as any).jsonSchema).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['id', 'note'],
    });

    const tools = buildAiSdkTools(builder, registry.tools);
    expect(tools.touch).toBeDefined();

    // Verify the tool can be executed with valid args (schema is built from validation metadata)
    const result = await tools.touch.execute({ id: '1', note: 'hello' });
    expect(JSON.parse(result)).toEqual({ id: '1', note: 'hello' });
  });

  test('toolParametersSchema emits an explicit empty object for no-argument tools', async () => {
    @Controller('/items')
    class NoArgsController {
      @Post('/mine')
      @McpTool('List my items')
      mine() {
        return ['item'];
      }
    }

    const { registry } = await bootWith(NoArgsController);
    const tool = registry.tools.find((t) => t.name === 'mine')!;
    expect((toolParametersSchema(tool) as any).jsonSchema).toEqual({
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });
});
