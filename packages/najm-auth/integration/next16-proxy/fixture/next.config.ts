import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const fixtureDir = dirname(fileURLToPath(import.meta.url));

const LOCKFILES = ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];

function declaresWorkspaces(dir: string): boolean {
  const manifest = resolve(dir, 'package.json');
  if (!existsSync(manifest)) return false;
  try {
    const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { workspaces?: unknown };
    const workspaces = parsed.workspaces;
    if (Array.isArray(workspaces)) return workspaces.length > 0;
    if (workspaces && typeof workspaces === 'object') {
      return Array.isArray((workspaces as { packages?: unknown }).packages);
    }
    return false;
  } catch {
    return false;
  }
}

function hasLockfile(dir: string): boolean {
  return LOCKFILES.some((file) => existsSync(resolve(dir, file)));
}

/**
 * Nearest ancestor wins, and a workspace declaration is checked before a
 * lockfile at every level — mirroring the shared Najm contract without
 * importing it here, so this fixture adds no runtime dependency on
 * `najm-next`. A stray lockfile above the checkout (e.g. in a home
 * directory) therefore never becomes the inferred root.
 */
function findWorkspaceRoot(startDir: string): string {
  let dir = resolve(startDir);
  for (;;) {
    if (declaresWorkspaces(dir) || hasLockfile(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

const workspaceRoot = findWorkspaceRoot(fixtureDir);

const config: NextConfig = {
  distDir: process.env.NAJM_NEXT_DIST_DIR ?? '.next',
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default config;
