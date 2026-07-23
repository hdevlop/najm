// ============================================================================
// najm-router - Response Utilities
// ============================================================================
// Provides multiple approaches for response wrapping:
// 1. @ResMsg() decorator - Method-level response messages
// 2. Helper functions - ok(), created(), etc.
// 3. Middleware approach - Auto-wrap all responses
// ============================================================================

import { MetaHelper } from 'diject';

// ============================================================================
// TOKENS
// ============================================================================

export const RES_MSG_META = Symbol.for('najm:response:message');
export const RES_OPTIONS_META = Symbol.for('najm:response:options');
export const RAW_RESPONSE_META = Symbol.for('najm:response:raw');
export const RAW_CONTROLLER_META = Symbol.for('najm:controller:raw');

// ============================================================================
// TYPES
// ============================================================================

export interface ResponseMessageOptions {
  /** 
   * Message text or i18n key
   * If starts with a namespace (e.g., 'users.success.created'), treated as i18n key
   */
  message?: string;
  
  /** 
   * Force i18n translation (useful when key doesn't contain dots)
   * @default auto-detected based on message format
   */
  i18n?: boolean;
  
  /**
   * HTTP status code
   * @default 200
   */
  status?: number;
  
  /**
   * Custom status string
   * @default 'success'
   */
  statusText?: 'success' | 'error' | string;
  
  /**
   * Include timestamp in response
   * @default false
   */
  timestamp?: boolean;
}

export interface WrappedResponse<T = unknown> {
  data: T;
  message?: string;
  status: string;
  timestamp?: string;
}

export interface ResponseConfig {
  /** Enable auto-wrapping for all responses */
  autoWrap?: boolean;
  
  /** Default status text */
  defaultStatus?: string;
  
  /** Include timestamp by default */
  includeTimestamp?: boolean;
  
  /** 
   * Translation function (injected by i18n plugin)
   * If not provided, messages are used as-is
   */
  translator?: (key: string, params?: Record<string, unknown>) => string;
}

// ============================================================================
// @ResMsg() DECORATOR
// ============================================================================

/**
 * Method decorator to define response message
 * 
 * @example
 * ```typescript
 * // Simple text message
 * @Get('/')
 * @ResMsg('Users retrieved successfully')
 * async getUsers() {
 *   return this.userService.findAll();
 * }
 * 
 * // I18n key (auto-detected by dots)
 * @Post('/')
 * @ResMsg('users.success.created')
 * async create(@Body() data: CreateUserDto) {
 *   return this.userService.create(data);
 * }
 * 
 * // With options
 * @Post('/')
 * @ResMsg({ message: 'users.success.created', status: 201 })
 * async create(@Body() data: CreateUserDto) {
 *   return this.userService.create(data);
 * }
 * 
 * // Force i18n for keys without dots
 * @Delete('/:id')
 * @ResMsg({ message: 'deleted', i18n: true })
 * async delete(@Params('id') id: string) {
 *   return this.userService.delete(id);
 * }
 * ```
 */
export function ResMsg(messageOrOptions: string | ResponseMessageOptions): MethodDecorator {
  return (target, methodName, descriptor) => {
    const options: ResponseMessageOptions = 
      typeof messageOrOptions === 'string' 
        ? { message: messageOrOptions }
        : messageOrOptions;
    
    MetaHelper.define(RES_MSG_META, options, target.constructor, methodName as string);
    return descriptor;
  };
}

/**
 * Alias for @ResMsg with status 201
 */
export function ResCreated(message?: string): MethodDecorator {
  return ResMsg({ message, status: 201 });
}

/**
 * Alias for @ResMsg with no content (204)
 */
export function ResNoContent(): MethodDecorator {
  return ResMsg({ status: 204 });
}

// ============================================================================
// RAW RESPONSE DECORATORS
// ============================================================================

/**
 * Method decorator to skip response wrapping
 * Use when you need raw response (webhooks, streams, custom formats)
 * 
 * @example
 * ```typescript
 * @Get('/health')
 * @RawResponse()
 * async health() {
 *   return { status: 'ok' };  // Returns as-is, no wrapping
 * }
 * 
 * @Post('/webhook')
 * @RawResponse()
 * async webhook() {
 *   return { received: true };
 * }
 * ```
 */
export function RawResponse(): MethodDecorator {
  return (target, methodName, descriptor) => {
    MetaHelper.define(RAW_RESPONSE_META, true, target.constructor, methodName as string);
    return descriptor;
  };
}

/**
 * Class decorator to skip response wrapping for entire controller
 * 
 * @example
 * ```typescript
 * @Controller('/webhooks')
 * @RawController()
 * export class WebhookController {
 *   @Post('/stripe')
 *   async stripe() {
 *     return { received: true };  // No wrapping
 *   }
 * }
 * ```
 */
export function RawController(): ClassDecorator {
  return (target) => {
    MetaHelper.define(RAW_CONTROLLER_META, true, target);
    return target;
  };
}

// ============================================================================
// HELPER FUNCTIONS (Option 2)
// ============================================================================

/**
 * Wrap data with success response
 * 
 * @example
 * ```typescript
 * @Get('/')
 * async getUsers() {
 *   const users = await this.userService.findAll();
 *   return ok(users, 'Users retrieved');
 * }
 * ```
 */
export function ok<T>(data: T, message?: string): WrappedResponse<T> {
  return {
    data,
    message,
    status: 'success',
  };
}

/**
 * Wrap data with created response (implies 201)
 */
export function created<T>(data: T, message?: string): WrappedResponse<T> & { statusCode: 201 } {
  return {
    data,
    message,
    status: 'success',
    statusCode: 201,
  } as WrappedResponse<T> & { statusCode: 201 };
}

/**
 * Wrap data with updated response
 */
export function updated<T>(data: T, message?: string): WrappedResponse<T> {
  return {
    data,
    message,
    status: 'success',
  };
}

/**
 * Wrap data with deleted response
 */
export function deleted<T>(data: T, message?: string): WrappedResponse<T> {
  return {
    data,
    message,
    status: 'success',
  };
}

/**
 * Return paginated response
 */
export function paginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message?: string
): WrappedResponse<T[]> & { pagination: typeof pagination } {
  return {
    data,
    message,
    status: 'success',
    pagination,
  } as WrappedResponse<T[]> & { pagination: typeof pagination };
}

// ============================================================================
// METADATA HELPERS
// ============================================================================

/**
 * Get response message options from a method
 */
export function getResponseMessage(
  target: any, 
  methodName: string
): ResponseMessageOptions | undefined {
  return MetaHelper.get<ResponseMessageOptions>(RES_MSG_META, target, methodName);
}

/**
 * Check if method has @RawResponse() decorator
 */
export function isRawResponse(target: any, methodName: string): boolean {
  return MetaHelper.get<boolean>(RAW_RESPONSE_META, target, methodName) === true;
}

/**
 * Check if controller has @RawController() decorator
 */
export function isRawController(target: any): boolean {
  return MetaHelper.get<boolean>(RAW_CONTROLLER_META, target) === true;
}

/**
 * Check if response should skip wrapping
 */
export function shouldSkipWrapping(target: any, methodName: string): boolean {
  return isRawController(target) || isRawResponse(target, methodName);
}

/**
 * Check if a message looks like an i18n key
 * Keys typically have dots (e.g., 'users.success.created')
 */
export function isI18nKey(message: string): boolean {
  return message.includes('.');
}

/**
 * Resolve message - either translate if i18n key or return as-is
 */
export function resolveMessage(
  message: string | undefined,
  options: ResponseMessageOptions,
  translator?: (key: string) => string
): string | undefined {
  if (!message) return undefined;
  
  const shouldTranslate = options.i18n ?? isI18nKey(message);
  
  if (shouldTranslate && translator) {
    return translator(message);
  }
  
  return message;
}
