import { plugin } from 'najm-core';
import { ValidationService } from './ValidationService';
import type { ValidationPluginConfig } from './types';
import { VALIDATION_CONFIG } from './tokens';

/**
 * Validation plugin factory
 *
 * Provides request validation using Zod schemas with smart defaults
 *
 * @example
 * // Default configuration
 * const server = new Server()
 *   .use(validation())
 *
 * @example
 * // Custom configuration
 * const server = new Server()
 *   .use(validation({
 *     stripUnknown: true,
 *     errorStatus: 422,
 *     errorFormatter: customFormatter
 *   }))
 *
 * @example
 * // Disable validation
 * const server = new Server()
 *   .use(validation({ enabled: false }))
 */
export const validation = (config: ValidationPluginConfig = {}) =>
  plugin('validation')
    .version('0.0.1')
    .services(ValidationService)
    .config(VALIDATION_CONFIG, config)
    .build();