import 'reflect-metadata';
import { afterEach, describe, expect, test } from 'bun:test';
import { Body, Controller, Post, Server, Service, User } from 'najm-core';
import { createGuard, USER } from 'najm-guard';
import { Validate } from 'najm-validation';
import { z } from 'zod';
import { McpBuilderService, McpTool, mcp, resolveRegisteredToolInputSchema } from '../src';
import type { McpConfig } from '../src';

let server: Server | undefined;
let port = 5390;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function boot(config: Partial<McpConfig>, ...classes: any[]) {
  const listenPort = port++;
  server = await new Server({ isolated: true })
    .use(mcp({ name: 'invocation-hook-test', version: '1.0.0', path: '/mcp', ...config }))
    .load(...classes)
    .listen(listenPort);
  const container = (server as any).container;
  return { container, builder: container.get(McpBuilderService) as McpBuilderService,
    endpoint: `http://localhost:${listenPort}/mcp` };
}

describe('MCP invocation hook', () => {
  test('advertises separate input, runs after guards, and isolates parallel calls on one controller', async () => {
    let container: any;
    let guardCalls = 0;
    let releaseSlow!: () => void;
    const slowWait = new Promise<void>((resolve) => { releaseSlow = resolve; });

    @Service()
    class AllowedGuard {
      canActivate() {
        guardCalls++;
        expect(container.store.get('selectedYear')).toBeUndefined();
        expect(container.get(USER)?.id).toBe('actor-1');
        return true;
      }
    }
    const Allowed = createGuard(AllowedGuard);

    @Controller('/hook')
    class HookController {
      @Post('/read')
      @McpTool('Read in an isolated scope')
      @Allowed()
      @Validate({ body: z.object({ name: z.string() }) })
      async read(@Body() body: { name: string }, @User('id') actorId: string) {
        const first = container.store.get('selectedYear');
        if (body.name === 'slow') await slowWait;
        await Promise.resolve();
        return { body, actorId, first, second: container.store.get('selectedYear') };
      }
    }

    const app = await boot({
      toolInput: (tool) => tool.name === 'read' ? { academicYear: z.string().optional() } : undefined,
      invocationScope: () => ({ selectedYear: undefined }),
      aroundInvoke: ({ toolInput, container: scoped }, next) => {
        expect(guardCalls).toBeGreaterThan(0);
        return scoped.run({ selectedYear: toolInput.academicYear ?? 'active' }, next);
      },
    }, AllowedGuard, HookController);
    container = app.container;

    const tool = (app.builder as any).registry.tools[0];
    expect(Object.keys(resolveRegisteredToolInputSchema(tool)!)).toEqual(['name', 'academicYear']);

    const results = await container.run({ [USER.key]: { id: 'actor-1' }, selectedYear: 'outer' }, async () => {
      const slow = app.builder.invokeTool('read', { name: 'slow', academicYear: '2025-2026' });
      const fast = await app.builder.invokeTool('read', { name: 'fast', academicYear: '2026-2027' });
      releaseSlow();
      return { slow: await slow, fast, outer: container.store.get('selectedYear') };
    });

    expect(results.outer).toBe('outer');
    expect(guardCalls).toBe(2);
    expect(JSON.parse(results.slow.content[0].text)).toEqual({
      body: { name: 'slow' }, actorId: 'actor-1', first: '2025-2026', second: '2025-2026',
    });
    expect(JSON.parse(results.fast.content[0].text)).toEqual({
      body: { name: 'fast' }, actorId: 'actor-1', first: '2026-2027', second: '2026-2027',
    });
  });

  test('invalid extra input and denied guards never reach aroundInvoke', async () => {
    let hookCalls = 0;
    let handlerCalls = 0;

    @Service()
    class DenyGuard {
      canActivate() { return false; }
    }
    const Denied = createGuard(DenyGuard);

    @Controller('/denied')
    class DeniedController {
      @Post('/')
      @McpTool('Denied operation')
      @Denied()
      @Validate({ body: z.object({ value: z.string() }) })
      run(@Body() body: { value: string }) {
        handlerCalls++;
        return body;
      }
    }

    const { builder } = await boot({
      toolInput: () => ({ academicYear: z.string().optional() }),
      aroundInvoke: (_context, next) => { hookCalls++; return next(); },
    }, DenyGuard, DeniedController);

    const invalid = await builder.invokeTool('run', { value: 'x', academicYear: 42 });
    const denied = await builder.invokeTool('run', { value: 'x', academicYear: '2025-2026' });
    expect(invalid.isError).toBe(true);
    expect(denied.content[0].text).toBe('Error (FORBIDDEN): Access denied');
    expect(hookCalls).toBe(0);
    expect(handlerCalls).toBe(0);
  });

  test('nested calls restore the outer selected value after success and failure', async () => {
    let container: any;
    let builder: McpBuilderService;

    @Controller('/nested')
    class NestedController {
      @Post('/inner')
      @McpTool('Inner operation')
      @Validate({ body: z.object({ fail: z.boolean() }) })
      inner(@Body('fail') fail: boolean) {
        if (fail) throw new Error('inner failed');
        return { selected: container.store.get('selectedYear') };
      }

      @Post('/outer')
      @McpTool('Outer operation')
      @Validate({ body: z.object({}) })
      async outer() {
        const before = container.store.get('selectedYear');
        const good = await builder.invokeTool('inner', { fail: false, academicYear: '2026-2027' });
        const afterGood = container.store.get('selectedYear');
        const bad = await builder.invokeTool('inner', { fail: true, academicYear: '2024-2025' });
        return { before, afterGood, afterBad: container.store.get('selectedYear'),
          good: JSON.parse(good.content[0].text), bad: bad.isError };
      }
    }

    const app = await boot({
      toolInput: () => ({ academicYear: z.string().optional() }),
      invocationScope: () => ({ selectedYear: undefined }),
      aroundInvoke: ({ toolInput, container: scoped }, next) =>
        scoped.run({ selectedYear: toolInput.academicYear ?? 'active' }, next),
    }, NestedController);
    container = app.container;
    builder = app.builder;

    const result = await container.run({ selectedYear: 'caller' }, () =>
      builder.invokeTool('outer', { academicYear: '2025-2026' }));
    expect(JSON.parse(result.content[0].text)).toEqual({
      before: '2025-2026', afterGood: '2025-2026', afterBad: '2025-2026',
      good: { selected: '2026-2027' }, bad: true,
    });
    expect(container.store.get('selectedYear')).toBeUndefined();
  });

  test('HTTP MCP calls receive their own header, actor, and advertised year input', async () => {
    let container: any;
    @Controller('/http-hook')
    class HttpHookController {
      @Post('/read')
      @McpTool('Read the selected year')
      @Validate({ body: z.object({ value: z.string() }) })
      read(@Body('value') value: string, @User('id') actorId: string) {
        return { value, actorId, selected: container.store.get('selectedYear') };
      }
    }

    const app = await boot({
      auth: {
        type: 'bearer',
        validate: (token) => ({ user: { id: token } }),
      },
      toolInput: () => ({ academicYear: z.string().optional() }),
      invocationScope: () => ({ selectedYear: undefined }),
      aroundInvoke: ({ container, toolInput, header }, next) => {
        const fromHeader = header('X-Academic-Year');
        const fromInput = toolInput.academicYear;
        if (!fromHeader) throw new Error('Academic year header was not forwarded');
        if (fromHeader && fromInput && fromHeader !== fromInput) {
          throw new Error('Year selection conflict');
        }
        return container.run({ selectedYear: fromInput ?? fromHeader ?? 'active' }, next);
      },
    }, HttpHookController);
    container = app.container;

    const endpoint = app.endpoint;
    const discovery = await fetch(`${endpoint}/tools`, {
      headers: { Authorization: 'Bearer discovery-actor' },
    });
    expect(discovery.status).toBe(200);
    const advertised = await discovery.json();
    expect(advertised.tools.find((tool: any) => tool.name === 'read').args)
      .toEqual(['value', 'academicYear']);

    const clientModule = '@modelcontextprotocol/sdk/client';
    const transportModule = '@modelcontextprotocol/sdk/client/streamableHttp.js';
    const { Client } = await import(clientModule as string);
    const { StreamableHTTPClientTransport } = await import(transportModule as string);

    async function call(actor: string, year: string, includeToolYear: boolean) {
      const client = new Client({ name: `client-${actor}`, version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
        requestInit: { headers: { Authorization: `Bearer ${actor}`, 'X-Academic-Year': year } },
      });
      try {
        await client.connect(transport);
        const listed = await client.listTools();
        expect(listed.tools.find((tool: any) => tool.name === 'read')?.inputSchema.properties)
          .toHaveProperty('academicYear');
        const result = await client.callTool({
          name: 'read', arguments: {
            value: actor,
            ...(includeToolYear ? { academicYear: year } : {}),
          },
        });
        return JSON.parse(result.content?.[0]?.text ?? '{}');
      } finally {
        await transport.close();
      }
    }

    const [first, second] = await Promise.all([
      call('actor-a', '2025-2026', true),
      call('actor-b', '2026-2027', false),
    ]);
    expect(first).toEqual({ value: 'actor-a', actorId: 'actor-a', selected: '2025-2026' });
    expect(second).toEqual({ value: 'actor-b', actorId: 'actor-b', selected: '2026-2027' });
  });
});
