import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const appDir = resolve(import.meta.dir, '..');
const require = createRequire(import.meta.url);
const nextBin = resolve(dirname(require.resolve('next/package.json')), 'dist', 'bin', 'next');

// Next evaluates the API route while collecting page data. These values exist
// only in the build subprocess so a clean checkout can produce an artifact;
// `next start` still requires real JWT secrets from its runtime environment.
rmSync(resolve(appDir, '.next'), { recursive: true, force: true });

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: appDir,
  env: {
    ...process.env,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'playground-build-only-access-secret-not-for-runtime',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'playground-build-only-refresh-secret-not-for-runtime',
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
