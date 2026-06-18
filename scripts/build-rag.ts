#!/usr/bin/env bun
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const { spawnSync } = await import('child_process');

function run(label: string, cmd: string, args: string[], cwd: string) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('Building najm-rag (engine)...', 'bun', ['run', 'build'], join(rootDir, 'packages/najm-rag'));

console.log('\nDone!');
