#!/usr/bin/env bun
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function run(label: string, cmd: string, args: string[], cwd: string) {
  console.log(`\n-> ${label}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The downloadable artifact is the static Next export in apps/rag-studio/out.
// Build workspace packages first because the app imports their package exports.
run('Building najm-kit...', 'bun', ['run', 'build'], join(rootDir, 'packages/najm-kit'));
run('Building najm-rag engine...', 'bun', ['run', 'build'], join(rootDir, 'packages/najm-rag'));
run('Building standalone RAG Studio app...', 'bun', ['run', 'build'], join(rootDir, 'apps/rag-studio'));

console.log('\nDone. Standalone RAG Studio static app is in apps/rag-studio/out.');
