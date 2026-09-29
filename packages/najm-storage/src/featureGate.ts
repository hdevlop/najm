import { Err, getRoutes } from 'najm-core';
import type { StorageConfig } from './types';

/** Keep optional HTTP controllers inert even with an older router that imports them. */
export function storageFeatureGate(feature: 'routes' | 'studio'): ClassDecorator {
  return (target) => {
    for (const route of getRoutes(target)) {
      const handler = route.handler;
      route.handler = function (this: { storageConfig: StorageConfig }, ...args: unknown[]) {
        const enabled = feature === 'studio'
          ? this.storageConfig.studio === true
          : this.storageConfig.routes !== false;
        if (!enabled) Err('Not Found', 404);
        return handler.apply(this, args);
      };
    }
  };
}
