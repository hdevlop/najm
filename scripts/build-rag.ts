#!/usr/bin/env bun
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

console.log('Building RAG Studio...');
const { spawnSync } = await import('child_process');
const result = spawnSync('bun', ['run', 'build'], {
  cwd: join(rootDir, 'packages/najm-rag-studio'),
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status);

console.log('Building najm-rag...');
const { spawnSync: spawnSync2 } = await import('child_process');
const result2 = spawnSync2('bun', ['run', 'build'], {
  cwd: join(rootDir, 'packages/najm-rag'),
  stdio: 'inherit',
});
if (result2.status !== 0) process.exit(result2.status);
console.log('Done!');
