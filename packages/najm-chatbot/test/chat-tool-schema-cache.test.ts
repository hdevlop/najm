import 'reflect-metadata';
import { describe, test, expect } from 'bun:test';
import { Server, Body, Controller, Params, Post } from 'najm-core';
import { mcp, McpTool, McpRegistryService, type RegisteredTool } from 'najm-mcp';
import { z } from 'zod';
import { Validate } from 'najm-validation';
import { toolParametersSchema } from '../src/agent/McpToolAdapter';

let server: Server | undefined;
let port = 6000;

async function bootWith(...classes: any[]) {
  server = await new Server({ isolated: true })
    .use(mcp({ name: 'schema-cache-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .load(...classes)
    .listen(++port);
  const container = (server as any).container;
  const registry = container.get(McpRegistryService) as McpRegistryService;
  return { server: server!, registry };
}

describe('Phase 4 (C5) — toolParametersSchema is memoized per RegisteredTool identity', () => {
  test('repeated toolParametersSchema() calls for the same tool return the cached schema', async () => {
    @Controller('/items')
    class ItemsController {
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
    const { registry } = await bootWith(ItemsController);
    const tool = registry.tools.find((t) => t.name === 'touch')!;

    const first = toolParametersSchema(tool);
    const second = toolParametersSchema(tool);
    const third = toolParametersSchema(tool);

    expect(first).toBe(second);
    expect(second).toBe(third);

    await server!.stop();
  });

  test('different tool objects with the same name do not share a stale schema', async () => {
    const schemaA = z.object({ foo: z.string() });
    const schemaB = z.object({ bar: z.string() });
    const toolA: any = { name: 'same', validation: { params: undefined, body: schemaA } };
    const toolB: any = { name: 'same', validation: { params: undefined, body: schemaB } };

    const a = toolParametersSchema(toolA as unknown as RegisteredTool);
    const b = toolParametersSchema(toolB as unknown as RegisteredTool);
    expect(a).not.toBe(b);
    expect((a as any).jsonSchema.properties.foo).toBeDefined();
    expect((b as any).jsonSchema.properties.bar).toBeDefined();
  });

  test('caching is keyed by tool identity, not just by name', () => {
    const schemaA = z.object({ foo: z.string() });
    const schemaB = z.object({ bar: z.string() });
    const toolA: any = { name: 'same', validation: { params: undefined, body: schemaA } };
    const toolB: any = { name: 'same', validation: { params: undefined, body: schemaB } };

    const a = toolParametersSchema(toolA as unknown as RegisteredTool);
    const b = toolParametersSchema(toolB as unknown as RegisteredTool);
    expect(a).not.toBe(b);
  });
});
