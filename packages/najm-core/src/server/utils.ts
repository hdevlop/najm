// ============================================================================
// utils.ts - Small pure helpers for the Server class
// ============================================================================

import { Err } from '../errors';
import type { ServerOpts } from './types';

export const DEFAULT_PORT = 3000;

/** Strip trailing slashes and ensure a single leading slash. */
export function normalizeBasePath(path: string): string {
   return path.replace(/\/+$/, '').replace(/^(?!\/)/, '/');
}

export function normalizePort(rawPort: ServerOpts['port']): number {
   if (rawPort === undefined || rawPort === null || rawPort === '') {
      return DEFAULT_PORT;
   }

   if (typeof rawPort === 'number') {
      if (isValidPort(rawPort)) {
         return rawPort;
      }

      Err.invalidConfig('port', 'must be an integer between 0 and 65535');
   }

   if (typeof rawPort !== 'string') {
      Err.invalidConfig('port', `must be a number or numeric string, received "${String(rawPort)}"`);
   }

   const trimmed = (rawPort as string).trim();
   if (!trimmed) {
      return DEFAULT_PORT;
   }

   if (!/^\d+$/.test(trimmed)) {
      Err.invalidConfig('port', `must be a numeric string, received "${rawPort}"`);
   }

   const port = Number.parseInt(trimmed, 10);
   if (!isValidPort(port)) {
      Err.invalidConfig('port', 'must be an integer between 0 and 65535');
   }

   return port;
}

function isValidPort(port: number): boolean {
   return Number.isInteger(port) && port >= 0 && port <= 65535;
}
