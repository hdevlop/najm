import { createAlsToken } from 'najm-core';

/**
 * Metadata key for @Validate decorator
 */
export const VALIDATE_META = Symbol.for('najm:validate');

/**
 * Configuration token for validation plugin
 */
export const VALIDATION_CONFIG = Symbol.for('najm:validation:config');

/**
 * ALS tokens for validated request data
 * Stored in AsyncLocalStorage for request-scoped access
 */
export const VALIDATED_BODY = createAlsToken<any>('validated:body');
export const VALIDATED_PARAMS = createAlsToken<any>('validated:params');
export const VALIDATED_QUERY = createAlsToken<any>('validated:query');
export const VALIDATED_HEADERS = createAlsToken<any>('validated:headers');
