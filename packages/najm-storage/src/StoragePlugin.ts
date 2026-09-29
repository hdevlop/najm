// ============================================================================
// najm-storage - Plugin Factory
// ============================================================================

import { plugin } from 'najm-core';
import { events } from 'najm-event';
import { STORAGE_CONFIG, STORAGE_SERVICE } from './tokens';
import type { StorageConfig } from './types';
import { StorageService } from './StorageService';
import { StorageValidator } from './StorageValidator';
import { StorageController } from './StorageController';
import { StorageMcpTools } from './StorageMcpTools';
import { StorageStudioController } from './StorageStudioController';
import { AuditService } from './AuditService';

const mergeConfig = (config: StorageConfig): Required<Pick<StorageConfig, 'provider' | 'routes' | 'mcp'>> & StorageConfig => ({
  provider: config.provider ?? 'local',
  routes: config.routes ?? true,
  mcp: config.mcp ?? false,
  guards: config.guards,
  manageGuards: config.manageGuards,
  mcpUploadFromPath: config.mcpUploadFromPath,
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
  const hasEndpoints = config.routes !== false || config.studio === true || config.mcp === true;
  if (!hasEndpoints) return;

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
  if (merged.mcpUploadFromPath) {
    if (!merged.mcp || merged.mcpUploadFromPath.allowedRoots.length === 0) {
      throw new Error('storage.mcpUploadFromPath requires mcp: true and at least one allowed root');
    }
    if (process.env.NODE_ENV === 'production' && merged.mcpUploadFromPath.allowInProduction !== true) {
      throw new Error('storage.mcpUploadFromPath requires allowInProduction: true in production');
    }
  }
  const routeControllers = [
    ...(merged.routes ? [StorageController] : []),
    ...(merged.studio ? [StorageStudioController] : []),
  ];

  if (merged.routes) {
    for (const [methods, guards] of [
      [['serveFile', 'servePreview'], merged.guards],
      [['listFiles', 'getFileInfo', 'uploadFile', 'deleteFile', 'deleteNamespace'], merged.manageGuards ?? merged.guards],
    ] as const) {
      for (const method of methods) {
        const descriptor = Object.getOwnPropertyDescriptor(StorageController.prototype, method)!;
        for (const guard of guards ?? []) {
          (guard as MethodDecorator)(StorageController.prototype, method, descriptor);
        }
      }
    }
  }
  if (merged.studio) applyRouteGuards(merged.manageGuards ?? merged.guards, [StorageStudioController]);
  if (merged.mcp) applyRouteGuards(merged.manageGuards ?? merged.guards, [StorageMcpTools]);

  const builder = plugin('storage')
    .version('3.0.0')
    .depends(events())
    .services(StorageService, StorageValidator)
    // The identity-stable way in for packages that store files through this
    // plugin. The alias forwards to the same singleton registered above, so a
    // consumer loaded from a different copy of `najm-storage` writes to the
    // application's provider rather than to a second one of its own.
    .alias(STORAGE_SERVICE, StorageService)
    .config(STORAGE_CONFIG, merged);

  if (merged.routes) {
    builder.services(StorageController);
  }

  if (merged.provider === 'database' || merged.studio) {
    builder.requires('database');
  }

  if ((routeControllers.length > 0 || merged.mcp) &&
      (merged.guards?.length || merged.manageGuards?.length)) {
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
