/**
 * Validation target type
 */
export type ValidationTarget = 'body' | 'params' | 'query' | 'headers';

/**
 * Minimal schema shape required by validation plugin.
 * Supports both Zod v3 and v4 schema instances.
 */
export interface ValidationSchema {
  parse(data: unknown): unknown;
  strip?: () => ValidationSchema;
}

/**
 * Minimal Zod issue shape used for error formatting.
 */
export interface ZodIssueLike {
  path: PropertyKey[];
  message: string;
  code: string;
}

/**
 * Minimal Zod error shape used by framework internals.
 * Compatible with Zod v3 and v4 errors.
 */
export interface ZodErrorLike {
  issues: ZodIssueLike[];
}

/**
 * Error formatter function type
 */
export type ErrorFormatter = (error: ZodErrorLike, target: ValidationTarget) => any;

/**
 * Validation configuration for @Validate decorator
 */
export interface ValidationConfig {
  /**
   * Zod schema for request body validation
   */
  body?: ValidationSchema;

  /**
   * Zod schema for route params validation
   */
  params?: ValidationSchema;

  /**
   * Zod schema for query parameters validation
   */
  query?: ValidationSchema;

  /**
   * Zod schema for request headers validation
   */
  headers?: ValidationSchema;

  /**
   * Remove unknown fields from validated data (default: false)
   */
  stripUnknown?: boolean;

  /**
   * HTTP status code for validation errors (default: 400)
   */
  errorStatus?: number;

  /**
   * Custom error formatter for validation errors
   */
  errorFormatter?: ErrorFormatter;
}

/**
 * Input type for @Validate decorator
 * Can be a Zod schema (assumes body validation) or full config object
 */
export type ValidateInput = ValidationSchema | ValidationConfig;

/**
 * Plugin configuration options
 */
export interface ValidationPluginConfig {
  /**
   * Enable or disable validation globally (default: true)
   */
  enabled?: boolean;

  /**
   * Default strip unknown fields behavior (default: false)
   */
  stripUnknown?: boolean;

  /**
   * Default HTTP status code for validation errors (default: 400)
   */
  errorStatus?: number;

  /**
   * Global error formatter
   */
  errorFormatter?: ErrorFormatter;
}
