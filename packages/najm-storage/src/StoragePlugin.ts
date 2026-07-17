// ============================================================================
// najm-storage - Plugin Factory
// ============================================================================

import { plugin } from 'najm-core';
import { events } from 'najm-event';
import { STORAGE_CONFIG } from './tokens';
import type { StorageConfig } from './types';
import { StorageService } from './StorageService';
import { StorageValidator } from './StorageValidator';
import { StorageController } from './StorageController';
import { StorageMcpTools } from './StorageMcpTools';
import { StorageStudioController } from './StorageStudioController';
import { AuditService } from './AuditService';

const mergeConfig = (config: StorageConfig): Required<Pick<StorageConfig, 'provider' | 'mcp'>> & StorageConfig => ({
  provider: config.provider ?? 'local',
  mcp: config.mcp ?? false,
  guards: config.guards,
  dialect: config.dialect,             // optional — auto-detected if omitted
  schema: config.schema,               // optional — overrides auto-detection
  database: config.database ?? 'default',
  basePath: config.basePath ?? 'storage',
  servePrefix: config.servePrefix ?? '',
  maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024,
  allowedCategories: config.allowedCategories,
  blockedExtensions: config.blockedExtensions,
  enableCascadeDelete: config.enableCascadeDelete ?? true,
  cacheMaxAge: config.cacheMaxAge ?? 31536000,
  studio: config.studio ?? false,
  preview: {
    enabled: config.preview?.enabled ?? false,
    cacheDir: config.preview?.cacheDir ?? '.thumbnails',
    defaultQuality: config.preview?.defaultQuality ?? 80,
    maxDimension: config.preview?.maxDimension ?? 2048,
    maxCacheBytes: config.preview?.maxCacheBytes,
  },
});

function assertExplicitGuards(config: StorageConfig): void {
  if (!Object.prototype.hasOwnProperty.call(config, 'guards')) {
    throw new Error(
      'storage.guards must be configured explicitly. Pass guards such as [isAuth()] to protect storage routes, or guards: [] to intentionally expose public storage routes.',
    );
  }
}

function applyRouteGuards(guards: StorageConfig['guards'], controllers: Function[]): void {
  if (!guards?.length) return;

  for (const controller of controllers) {
    for (const guard of guards) {
      (guard as ClassDecorator)(controller);
    }
  }
}

/**
 * Create the storage plugin.
 *
 * **Plugin ordering:** When `mcp: true`, the `mcp()` plugin must be
 * registered **before** `storage()` in the server chain:
 *
 * ```typescript
 * new Server()
 *   .use(mcp({ name: 'app', version: '1.0.0' }))  // first
 *   .use(storage({ mcp: true, guards: [isAuth()] })) // then storage
 * ```
 *
 * Similarly, when `provider: 'database'`, the `database()` plugin must
 * be registered before `storage()`.
 */
export const storage = (config: StorageConfig = {}) => {
  assertExplicitGuards(config);
  const merged = mergeConfig(config);
  const routeControllers = merged.studio
    ? [StorageController, StorageStudioController]
    : [StorageController];

  applyRouteGuards(merged.guards, routeControllers);

  const builder = plugin('storage')
    .version('2.0.0')
    .depends(events())
    .services(StorageService, StorageValidator, StorageController)
    .config(STORAGE_CONFIG, merged);

  if (merged.provider === 'database' || merged.studio) {
    builder.requires('database');
  }

  if (merged.guards?.length) {
    builder.requires('guards');
  }

  if (merged.mcp) {
    builder.requires('mcp');
    builder.services(StorageMcpTools);
  }

  if (merged.studio) {
    builder.services(StorageStudioController, AuditService);
  }

  return builder.build();
};
