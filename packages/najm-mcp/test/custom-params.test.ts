import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Controller, createParamDecorator, Err, Get, Server, Service, User } from 'najm-core';
import { createGuard, USER } from 'najm-guard';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { McpTool, mcp } from '../src';
import { McpBuilderService, resolveRegisteredToolInputObjectSchema } from '../src/McpBuilderService';
import { McpRegistryService } from '../src/McpRegistryService';

let server: Server | undefined;
let port = 5300;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function bootWith(...classes: any[]) {
  const listening = port++;
  server = await new Server({ isolated: true, silent: true })
    .use(mcp({ name: 'custom-params-test', version: '1.0.0', path: '/mcp', transports: ['http'] }))
    .load(...classes)
    .listen(listening);
  const container = (server as any).container;
  const builder = container.get(McpBuilderService) as McpBuilderService;
  return { builder, container, port: listening };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

/** Reads the selection the way an application decorator would. */
const Selection = createParamDecorator(async ({ transport, query, header }) => {
  const value = query('selection') ?? header('x-selection') ?? 'default';
  await sleep(value === 'slow' ? 30 : 1);
  return { transport, value };
});

const selectionQuery = z.object({ selection: z.string().optional() });

describe('createParamDecorator in MCP tool calls', () => {
  test('resolves from the tool input, beside a later @User() argument', async () => {
    @Controller('/selection')
    class SelectionController {
      @Get('/')
      @McpTool('Echo the resolved selection')
      @Validate({ query: selectionQuery })
      read(@Selection() selection: unknown, @User('id') userId: string) {
        return { selection, userId };
      }
    }

    const { builder, container } = await bootWith(SelectionController);
    const result = await container.run({ [USER.key]: { id: 'user_1' } }, () =>
      builder.invokeTool('read', { selection: '2025-2026' }));

    expect(result.isError).toBeUndefined();
    expect(text(result)).toEqual({ selection: { transport: 'mcp', value: '2025-2026' }, userId: 'user_1' });
  });

  test('advertises the declared query key as a tool argument', async () => {
    @Controller('/advertised')
    class AdvertisedController {
      @Get('/')
      @McpTool('Advertise the selection argument')
      @Validate({ query: selectionQuery })
      advertised(@Selection() selection: unknown) {
        return selection;
      }
    }

    const { container } = await bootWith(AdvertisedController);
    const registry = container.get(McpRegistryService) as McpRegistryService;
    const tool = registry.tools.find((entry) => entry.name === 'advertised')!;

    expect(Object.keys(resolveRegisteredToolInputObjectSchema(tool) as object)).toEqual(['selection']);
  });

  test('does not run the resolver when a guard refuses the call', async () => {
    let resolved = false;
    const Watched = createParamDecorator(() => {
      resolved = true;
      return 'resolved';
    });

    @Service()
    class DenyGuard {
      canActivate() {
        return false;
      }
    }

    @Controller('/guarded')
    class GuardedController {
      @Get('/')
      @McpTool('Guarded tool')
      @createGuard(DenyGuard)()
      guarded(@Watched() value: string) {
        return { value };
      }
    }

    const { builder } = await bootWith(DenyGuard, GuardedController);
    const result = await builder.invokeTool('guarded', {});

    expect(result.isError).toBe(true);
    expect(resolved).toBe(false);
  });

  test('a rejected resolver fails the call before the handler runs', async () => {
    let handled = false;
    const Refuse = createParamDecorator(async () => Err(403, 'Refused by the resolver'));

    @Controller('/refused')
    class RefusedController {
      @Get('/')
      @McpTool('Refused tool')
      refused(@Refuse() value: unknown) {
        handled = true;
        return { value };
      }
    }

    const { builder } = await bootWith(RefusedController);
    const result = await builder.invokeTool('refused', {});

    expect(result.isError).toBe(true);
    expect(handled).toBe(false);
  });

  test('tool calls sharing one request store each receive their own value', async () => {
    @Controller('/batch')
    class BatchController {
      @Get('/')
      @McpTool('Batch member')
      @Validate({ query: selectionQuery })
      async member(@Selection() selection: { value: string }) {
        await sleep(20);
        return { value: selection.value };
      }
    }

    const { builder, container } = await bootWith(BatchController);
    const [slow, fast] = await container.run({ requestId: 'one-message' }, () => Promise.all([
      builder.invokeTool('member', { selection: 'slow' }),
      builder.invokeTool('member', { selection: 'fast' }),
    ]));

    expect(text(slow)).toEqual({ value: 'slow' });
    expect(text(fast)).toEqual({ value: 'fast' });
  });

  test('resolves in a real Streamable HTTP tool call and reads the transport header', async () => {
    @Controller('/remote')
    class RemoteController {
      @Get('/')
      @McpTool('Remote selection')
      @Validate({ query: selectionQuery })
      remote(@Selection() selection: unknown) {
        return selection;
      }
    }

    const { port: listening } = await bootWith(RemoteController);
    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    const call = async (headers: Record<string, string>, args: Record<string, unknown>) => {
      const client = new Client({ name: 'custom-params-client', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`http://localhost:${listening}/mcp`),
        { requestInit: { headers } },
      );
      await client.connect(transport);
      try {
        const result = await client.callTool({ name: 'remote', arguments: args });
        return JSON.parse(result.content?.[0]?.text ?? '{}');
      } finally {
        await transport.close();
      }
    };

    expect(await call({}, { selection: 'from-input' })).toEqual({ transport: 'mcp', value: 'from-input' });
    expect(await call({ 'X-Selection': 'from-header' }, {})).toEqual({ transport: 'mcp', value: 'from-header' });
  });
});
