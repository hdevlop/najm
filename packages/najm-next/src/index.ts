export { defineNajmNextConfig } from './configurable';
export { createNajmNextConfig, IMAGE_CACHE_TTL_SECONDS, SERVER_EXTERNAL_PACKAGES } from './internal/createConfig';
export {
  MAXIMUM_TESTED_NEXT_MAJOR,
  MINIMUM_NEXT_VERSION,
  assertNextCompatible,
  compareVersions,
  parseVersion,
  readNextVersion,
  resetCompatibilityWarning,
} from './internal/compatibility';
export { DEV_ORIGINS_ENV, parseDevOrigins } from './internal/devOrigins';
export { DEFAULT_DIST_DIR, DIST_DIR_ENV, resolveDistDir } from './internal/distDir';
export { NajmNextConfigError } from './internal/errors';
export { SERVICE_WORKER_FILES, detectServiceWorkers, serviceWorkerHeaders } from './internal/serviceWorker';
export { findWorkspaceRoot } from './internal/workspaceRoot';
export { createNajmServiceWorker } from './pwa';
export type {
  NajmOfflineDocumentOptions,
  NajmServiceWorkerOptions,
  NajmServiceWorkerRoute,
} from './pwa';
export type { EnvRecord, HeaderRule, NajmNextConfigOverrides, NextConfig } from './internal/types';
