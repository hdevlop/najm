import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { RagScanCommand, type ScannedTool } from '../src/Commands/RagScanCommand';

async function runCli(args: string[]) {
  const proc = Bun.spawn({
    cmd: ['bun', 'src/index.ts', ...args],
    cwd: import.meta.dir + '/..',
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...Bun.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { output: `${stdout}${stderr}`, exitCode };
}

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rag-scan-test-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test-project' }), 'utf-8');
  return dir;
}

describe('rag:scan command', () => {
  test('shows command help without opening the interactive prompt', async () => {
    const result = await runCli(['rag:scan', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('najm-api rag:scan');
    expect(result.output).toContain('Scans controllers for @McpTool methods');
    expect(result.output).not.toContain('Scanning controllers');
  });

  test('--dry-run writes nothing', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      const routingPath = join(dir, 'src/server/config/chatbot/routing.json');
      const initialSemantics = JSON.stringify({ items: [{ toolName: 'old_tool', phrases: [{ lang: 'en', phrase: 'old phrase' }] }] }, null, 2) + '\n';
      const initialRouting = JSON.stringify({ mode: 'routing' }, null, 2) + '\n';

      mkdirSync(join(dir, 'src/server/config/chatbot'), { recursive: true });
      writeFileSync(semanticsPath, initialSemantics, 'utf-8');
      writeFileSync(routingPath, initialRouting, 'utf-8');

      const cmd = new RagScanCommand();
      (cmd as any).dryRun = true;
      await cmd.run([
        { name: 'new_tool', group: 'test', description: 'new tool', destructive: false },
      ]);

      expect(readFileSync(semanticsPath, 'utf-8')).toBe(initialSemantics);
      expect(readFileSync(routingPath, 'utf-8')).toBe(initialRouting);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('derives semantics from scanned tools', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'products_list', group: 'products', description: 'List all products', destructive: false },
        { name: 'products_delete', group: 'products', description: 'Delete a product', destructive: true },
      ]);

      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));

      expect(semantics.items.length).toBe(2);
      expect(semantics.items[0].toolName).toBe('products_list');
      expect(semantics.items[0].phrases[0].phrase).toBe('List all products');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('--prune removes orphaned toolName entries', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      mkdirSync(join(dir, 'src/server/config/chatbot'), { recursive: true });
      writeFileSync(semanticsPath, JSON.stringify({
        items: [
          { toolName: 'stale_tool', phrases: [{ lang: 'en', phrase: 'stale' }] },
          { toolName: 'live_tool', phrases: [{ lang: 'en', phrase: 'live' }] },
        ],
      }, null, 2) + '\n', 'utf-8');

      const cmd = new RagScanCommand();
      (cmd as any).prune = true;
      await cmd.run([
        { name: 'live_tool', group: 'test', description: 'Live tool', destructive: false },
      ]);

      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));
      expect(semantics.items.length).toBe(1);
      expect(semantics.items[0].toolName).toBe('live_tool');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('preserves user-edited phrases under existing toolName', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      mkdirSync(join(dir, 'src/server/config/chatbot'), { recursive: true });
      writeFileSync(semanticsPath, JSON.stringify({
        items: [
          { toolName: 'existing_tool', phrases: [
            { lang: 'en', phrase: 'original' },
            { lang: 'fr', phrase: 'originale' },
          ]},
        ],
      }, null, 2) + '\n', 'utf-8');

      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'existing_tool', group: 'test', description: 'new description', destructive: false },
      ]);

      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));
      expect(semantics.items[0].phrases.length).toBe(2);
      expect(semantics.items[0].phrases.some((p: any) => p.lang === 'fr')).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe('rag:scan route-aware heuristics', () => {
  test('does not write dangerousIntentKeywords (deprecated)', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'products_delete', group: 'products', description: 'Delete a product', destructive: true, httpMethod: 'delete', routePath: '/:id', controllerPath: '/products', fullPath: '/products/:id' },
      ]);

      const routing = JSON.parse(readFileSync(join(dir, 'src/server/config/chatbot/routing.json'), 'utf-8'));
      expect(routing.dangerousIntentKeywords).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('strips legacy dangerousIntentKeywords from existing routing.json', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      mkdirSync(join(dir, 'src/server/config/chatbot'), { recursive: true });
      writeFileSync(join(dir, 'src/server/config/chatbot/routing.json'), JSON.stringify({
        mode: 'routing',
        dangerousIntentKeywords: { users: ['users_remove_role'] },
      }, null, 2) + '\n', 'utf-8');

      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'users_remove_role', group: 'users', description: 'Remove role', destructive: true },
      ]);

      const routing = JSON.parse(readFileSync(join(dir, 'src/server/config/chatbot/routing.json'), 'utf-8'));
      expect(routing.dangerousIntentKeywords).toBeUndefined();
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('infers dependencies from route hierarchy', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'orders_get_by_id', group: 'orders', description: 'Get order', destructive: false, httpMethod: 'get', routePath: '/:id', controllerPath: '/orders', fullPath: '/orders/:id' },
        { name: 'orders_get_items', group: 'orders', description: 'Get order items', destructive: false, httpMethod: 'get', routePath: '/:id/items', controllerPath: '/orders', fullPath: '/orders/:id/items' },
      ]);

      const routing = JSON.parse(readFileSync(join(dir, 'src/server/config/chatbot/routing.json'), 'utf-8'));
      expect(routing.dependencies['orders_get_items']).toEqual(['orders_get_by_id']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('does not overwrite existing dependencies', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      mkdirSync(join(dir, 'src/server/config/chatbot'), { recursive: true });
      writeFileSync(join(dir, 'src/server/config/chatbot/routing.json'), JSON.stringify({
        mode: 'routing',
        dependencies: { orders_get_items: ['orders_get_by_id', 'orders_get_status'] },
      }, null, 2) + '\n', 'utf-8');

      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'orders_get_by_id', group: 'orders', description: 'Get order', destructive: false, httpMethod: 'get', routePath: '/:id', controllerPath: '/orders', fullPath: '/orders/:id' },
        { name: 'orders_get_items', group: 'orders', description: 'Get order items', destructive: false, httpMethod: 'get', routePath: '/:id/items', controllerPath: '/orders', fullPath: '/orders/:id/items' },
      ]);

      const routing = JSON.parse(readFileSync(join(dir, 'src/server/config/chatbot/routing.json'), 'utf-8'));
      expect(routing.dependencies['orders_get_items']).toEqual(['orders_get_by_id', 'orders_get_status']);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('writes sidecar notes for dependency heuristics', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagScanCommand();
      await cmd.run([
        { name: 'orders_get_by_id', group: 'orders', description: 'Get order', destructive: false, httpMethod: 'get', routePath: '/:id', controllerPath: '/orders', fullPath: '/orders/:id' },
        { name: 'orders_get_items', group: 'orders', description: 'Get items', destructive: false, httpMethod: 'get', routePath: '/:id/items', controllerPath: '/orders', fullPath: '/orders/:id/items' },
      ]);

      const sidecarPath = join(dir, 'src/server/config/chatbot/routing.json.scan-notes.md');
      expect(existsSync(sidecarPath)).toBe(true);
      const content = readFileSync(sidecarPath, 'utf-8');
      expect(content).toContain('dependencies');
      expect(content).toContain('orders_get_items');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('--dry-run does not write sidecar notes', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagScanCommand();
      (cmd as any).dryRun = true;
      await cmd.run([
        { name: 'test_tool', group: 'test', description: 'Test', destructive: true },
      ]);

      const sidecarPath = join(dir, 'src/server/config/chatbot/routing.json.scan-notes.md');
      expect(existsSync(sidecarPath)).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
