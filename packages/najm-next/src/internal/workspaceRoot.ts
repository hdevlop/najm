import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const WORKSPACE_MANIFESTS = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];
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

function hasAny(dir: string, files: readonly string[]): boolean {
  return files.some((file) => existsSync(resolve(dir, file)));
}

/**
 * Nearest ancestor wins, and a workspace declaration is checked before a
 * lockfile at every level. Next's own detection walks to the *outermost*
 * lockfile, so a stray `bun.lock` in a home or parent directory silently
 * becomes the tracing root of every app checked out beneath it.
 */
export function findWorkspaceRoot(startDir: string = process.cwd()): string {
  const start = resolve(startDir);
  let dir = start;

  for (;;) {
    if (declaresWorkspaces(dir) || hasAny(dir, WORKSPACE_MANIFESTS) || hasAny(dir, LOCKFILES)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
