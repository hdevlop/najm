import { isAbsolute } from 'node:path';
import { NajmNextConfigError } from './errors';
import type { EnvRecord } from './types';

export const DIST_DIR_ENV = 'NAJM_NEXT_DIST_DIR';
export const DEFAULT_DIST_DIR = '.next';

export function resolveDistDir(env: EnvRecord = process.env): string {
  const raw = env[DIST_DIR_ENV]?.trim();
  if (!raw) return DEFAULT_DIST_DIR;

  if (isAbsolute(raw) || /^[a-zA-Z]:/.test(raw)) {
    throw new NajmNextConfigError(`${DIST_DIR_ENV} must be relative to the app directory, received "${raw}".`);
  }
  if (raw.split(/[\/]/).includes('..')) {
    throw new NajmNextConfigError(`${DIST_DIR_ENV} must not escape the app directory, received "${raw}".`);
  }
  return raw;
}
