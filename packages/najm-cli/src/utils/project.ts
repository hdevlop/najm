import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

export function findProjectRoot(cwd = process.cwd()): string {
  let dir = cwd;
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'package.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error('Could not find project root (no package.json found)');
}
