import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HeaderRule } from './types';

export const SERVICE_WORKER_FILES = ['sw.js', 'service-worker.js'] as const;

export function detectServiceWorkers(appDir: string = process.cwd()): string[] {
  return SERVICE_WORKER_FILES.filter((file) => existsSync(resolve(appDir, 'public', file)));
}

export function serviceWorkerHeaders(appDir: string = process.cwd()): HeaderRule[] {
  return detectServiceWorkers(appDir).map((file) => ({
    source: `/${file}`,
    headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      { key: 'Service-Worker-Allowed', value: '/' },
    ],
  }));
}
