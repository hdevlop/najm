#!/usr/bin/env bun
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Targets run one after another so neither clean step can delete the other's output.
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

rmSync(resolve(packageDir, 'dist'), { recursive: true, force: true });
runTsup('backend');
runTsup('studio');
