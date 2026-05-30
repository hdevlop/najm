#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runTsup(target: 'backend' | 'studio') {
  const result = spawnSync(process.execPath, ['run', 'tsup'], {
    cwd: packageDir,
    env: { ...process.env, NAJM_RAG_BUILD_TARGET: target },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runTsup('backend');
runTsup('studio');
