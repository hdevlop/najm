// ============================================================================
// moduleLoader.ts - Injectable discovery from modules & barrel files
// ============================================================================

import { isInjectable } from 'diject';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Constructor } from './types';

const BARREL_PATTERN = /^index\.(ts|tsx|js|mjs|cjs|mts|cts)$/;

/**
 * Extract every @Injectable class from a module's exports.
 */
export function collectInjectables(moduleExports: Record<string, unknown>): Constructor[] {
   const injectables: Constructor[] = [];
   for (const exported of Object.values(moduleExports)) {
      if (typeof exported === 'function' && isInjectable(exported)) {
         injectables.push(exported as Constructor);
      }
   }
   return injectables;
}

/**
 * Dynamically import every barrel file under the given roots and collect
 * their @Injectable exports. Used by server.scan() with folder paths —
 * not available in bundled environments (use .load() there instead).
 */
export async function loadInjectablesFromRoots(roots: Iterable<string>): Promise<Constructor[]> {
   const injectables: Constructor[] = [];

   for (const root of roots) {
      const absoluteRoot = resolveScanRoot(root);

      for (const barrel of collectBarrelEntries(absoluteRoot)) {
         const mod = await import(/* webpackIgnore: true */ pathToFileURL(barrel).href);
         injectables.push(...collectInjectables(mod as Record<string, unknown>));
      }
   }

   return injectables;
}

function resolveScanRoot(root: string): string {
   const absoluteRoot = isAbsolute(root) ? root : resolve(process.cwd(), root);

   if (!existsSync(absoluteRoot)) {
      throw new Error(`[najm] scan root does not exist: ${root}`);
   }

   if (!statSync(absoluteRoot).isDirectory()) {
      throw new Error(`[najm] scan root must be a directory: ${root}`);
   }

   return absoluteRoot;
}

function collectBarrelEntries(root: string): string[] {
   const barrels: string[] = [];
   const queue: string[] = [root];

   while (queue.length) {
      const current = queue.pop();
      if (!current) continue;

      for (const entry of readdirSync(current, { withFileTypes: true })) {
         const fullPath = join(current, entry.name);

         if (entry.isDirectory()) {
            queue.push(fullPath);
            continue;
         }

         if (entry.isFile() && BARREL_PATTERN.test(entry.name)) {
            barrels.push(fullPath);
         }
      }
   }

   barrels.sort();
   return barrels;
}
