import { describe, expect, test } from 'bun:test';

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

describe('chat:seed command', () => {
  test('shows command help without opening the interactive prompt', async () => {
    const result = await runCli(['chat:seed', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('najm-api chat:seed');
    expect(result.output).toContain('Generates seed code');
    expect(result.output).not.toContain('Select LLM provider');
  });
});
