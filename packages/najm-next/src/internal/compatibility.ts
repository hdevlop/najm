import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NajmNextConfigError } from './errors';

export const MINIMUM_NEXT_VERSION = '15.3.0';
export const MAXIMUM_TESTED_NEXT_MAJOR = 16;

export function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function readNextVersion(appDir: string = process.cwd()): string | null {
  try {
    const require = createRequire(resolve(appDir, 'noop.js'));
    const manifest = JSON.parse(readFileSync(require.resolve('next/package.json'), 'utf8')) as { version?: string };
    return manifest.version ?? null;
  } catch {
    return null;
  }
}

let warned = false;

export function assertNextCompatible(
  appDir: string = process.cwd(),
  warn: (message: string) => void = console.warn,
): string | null {
  const version = readNextVersion(appDir);
  if (!version) return null;

  if (compareVersions(version, MINIMUM_NEXT_VERSION) < 0) {
    throw new NajmNextConfigError(
      `next@${version} is not supported; najm-next requires next >= ${MINIMUM_NEXT_VERSION}.`,
    );
  }
  if (parseVersion(version)[0] > MAXIMUM_TESTED_NEXT_MAJOR && !warned) {
    warned = true;
    warn(
      `[najm-next] next@${version} is newer than the tested major (${MAXIMUM_TESTED_NEXT_MAJOR}.x); the preset may be out of date.`,
    );
  }
  return version;
}

export function resetCompatibilityWarning(): void {
  warned = false;
}
