// ============================================================================
// Middleware Plugin Factory (Fluent API)
// ============================================================================

import { plugin } from '../server';
import { MiddlewareService } from './MiddlewareService';
import { MIDDLEWARE_CONFIG } from './tokens';
import type { MiddlewarePluginConfig } from './types';

/**
 * Create middleware plugin for Najm server
 *
 * @example
 * ```typescript
 * // Auto-loaded internally by Server
 * // Or with custom config:
 * new Server()
 *   .use(middleware({ debug: true }))
 *   .load(MyController);
 * ```
 */
export const middleware = (config: MiddlewarePluginConfig = true) =>
   plugin('middleware')
      .version('1.0.0')
      .services(MiddlewareService)
      .config(MIDDLEWARE_CONFIG, config)
      .build();
