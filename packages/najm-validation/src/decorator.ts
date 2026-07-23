import { MetaHelper } from 'najm-core';
import type { ValidateInput, ValidationConfig, ValidationSchema } from './types';
import { VALIDATE_META } from './tokens';

/**
 * Checks if a value is a schema-like object
 */
function isValidationSchema(value: unknown): value is ValidationSchema {
  return value !== null &&
         value !== undefined &&
         typeof value === 'object' &&
         'parse' in value &&
         typeof (value as { parse?: unknown }).parse === 'function';
}

/**
 * @Validate decorator - Validates request data using Zod schemas
 *
 * Smart defaults: Pass a schema directly for body validation (most common use case)
 *
 * @example
 * // Body validation (90% use case)
 * @Validate(CreateUserSchema)
 * createUser(@Body() data) { ... }
 *
 * @example
 * // Multiple targets
 * @Validate({
 *   body: CreateUserSchema,
 *   params: z.object({ id: z.string().uuid() })
 * })
 * updateUser(@Params('id') id, @Body() data) { ... }
 *
 * @example
 * // With options
 * @Validate({
 *   body: CreateUserSchema,
 *   stripUnknown: true,
 *   errorStatus: 422
 * })
 * createUser(@Body() data) { ... }
 */
export function Validate(input: ValidateInput): MethodDecorator {
  // Smart detection: raw schema → assume body validation
  const config: ValidationConfig = isValidationSchema(input)
    ? { body: input }
    : input;

  return (target: any, methodName: string | symbol) => {
    MetaHelper.define(VALIDATE_META, config, target[methodName]);
  };
}

/**
 * Helper to retrieve validation config from metadata
 */
export function getValidationConfig(
  target: any,
  methodName?: string | symbol
): ValidationConfig | undefined {
  if (methodName) {
    return MetaHelper.get(VALIDATE_META, target[methodName]);
  }
  return MetaHelper.get(VALIDATE_META, target);
}
