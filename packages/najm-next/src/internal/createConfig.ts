import { assertNextCompatible } from './compatibility';
import { DEV_ORIGINS_ENV, parseDevOrigins } from './devOrigins';
import { resolveDistDir } from './distDir';
import { serviceWorkerHeaders } from './serviceWorker';
import { findWorkspaceRoot } from './workspaceRoot';
import type { EnvRecord, HeaderRule, NajmNextConfigOverrides, NextConfig } from './types';

export const IMAGE_CACHE_TTL_SECONDS = 2_678_400;
export const SERVER_EXTERNAL_PACKAGES = ['reflect-metadata'];

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function composeHeaders(own: HeaderRule[], overrides: NextConfig['headers']): NextConfig['headers'] | undefined {
  if (!own.length && !overrides) return undefined;
  return async () => [...own, ...(overrides ? await overrides() : [])];
}

export function createNajmNextConfig(
  overrides: NajmNextConfigOverrides = {},
  appDir: string = process.cwd(),
  env: EnvRecord = process.env,
): NextConfig {
  assertNextCompatible(appDir);

  const workspaceRoot = findWorkspaceRoot(appDir);
  const devOrigins = parseDevOrigins(env[DEV_ORIGINS_ENV]);
  const {
    turbopack,
    images,
    experimental,
    serverExternalPackages,
    allowedDevOrigins,
    headers,
    ...rest
  } = overrides;

  const merged: NextConfig = {
    distDir: resolveDistDir(env),
    poweredByHeader: false,
    outputFileTracingRoot: workspaceRoot,
    ...rest,
    turbopack: { root: workspaceRoot, ...turbopack },
    images: { minimumCacheTTL: IMAGE_CACHE_TTL_SECONDS, ...images },
    experimental: { externalDir: true, ...experimental },
    serverExternalPackages: dedupe([...SERVER_EXTERNAL_PACKAGES, ...(serverExternalPackages ?? [])]),
  };

  const origins = dedupe([...devOrigins, ...(allowedDevOrigins ?? [])]);
  if (origins.length) merged.allowedDevOrigins = origins;

  const composed = composeHeaders(serviceWorkerHeaders(appDir), headers);
  if (composed) merged.headers = composed;

  return merged;
}
