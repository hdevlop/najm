import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { RagInitCommand } from '../src/Commands/RagInitCommand';

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
  const dir = mkdtempSync(join(tmpdir(), 'rag-init-test-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test-project' }), 'utf-8');
  return dir;
}

describe('rag:init command', () => {
  test('shows command help without opening the interactive prompt', async () => {
    const result = await runCli(['rag:init', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('najm rag:init');
    expect(result.output).toContain('Scaffolds chatbot routing config');
    expect(result.output).not.toContain('Database dialect');
  });

  test('creates files on first run', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagInitCommand();
      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });

      const routingPath = join(dir, 'src/server/config/chatbot/routing.json');
      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      const testCasesPath = join(dir, 'src/server/config/chatbot/routing-test-cases.json');

      expect(existsSync(routingPath)).toBe(true);
      expect(existsSync(semanticsPath)).toBe(true);
      expect(existsSync(testCasesPath)).toBe(true);

      const routing = JSON.parse(readFileSync(routingPath, 'utf-8'));
      expect(routing.mode).toBe('routing');
      expect(routing.embedding.baseUrl).toBe('http://localhost:11434');
      expect(routing.maxTools).toBe(10);

      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));
      expect(semantics.items.length).toBe(2);
      expect(semantics.items[0].toolName).toBe('products_get_all');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('second run with same answers is a no-op on routing.json', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagInitCommand();
      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });

      const routingPath = join(dir, 'src/server/config/chatbot/routing.json');
      const firstContent = readFileSync(routingPath, 'utf-8');

      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });
      const secondContent = readFileSync(routingPath, 'utf-8');

      expect(secondContent).toBe(firstContent);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('second run preserves user-edited semantics phrases', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagInitCommand();
      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });

      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));
      semantics.items[0].phrases.push({ lang: 'es', phrase: 'listar todos los productos' });
      writeFileSync(semanticsPath, JSON.stringify(semantics, null, 2) + '\n', 'utf-8');

      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });
      const after = JSON.parse(readFileSync(semanticsPath, 'utf-8'));

      const esPhrase = after.items[0].phrases.find((p: any) => p.lang === 'es');
      expect(esPhrase).toBeDefined();
      expect(esPhrase.phrase).toBe('listar todos los productos');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('second run merges new sample tools without overwriting custom ones', async () => {
    const dir = makeTmpProject();
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
      const cmd = new RagInitCommand();
      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });

      const semanticsPath = join(dir, 'src/server/config/chatbot/semantics.json');
      const semantics = JSON.parse(readFileSync(semanticsPath, 'utf-8'));
      semantics.items.push({ toolName: 'custom_tool', phrases: [{ lang: 'en', phrase: 'do something custom' }] });
      writeFileSync(semanticsPath, JSON.stringify(semantics, null, 2) + '\n', 'utf-8');

      await cmd.run({ mode: 'routing', baseUrl: 'http://localhost:11434', model: 'embeddinggemma', maxTools: 10, addSamples: true });
      const after = JSON.parse(readFileSync(semanticsPath, 'utf-8'));

      expect(after.items.length).toBe(3);
      const custom = after.items.find((i: any) => i.toolName === 'custom_tool');
      expect(custom).toBeDefined();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
