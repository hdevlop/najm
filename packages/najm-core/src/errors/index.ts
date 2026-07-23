import { BaseError, DIError, DI_CODES } from "diject";
import { HttpError, HTTP_CODES } from "./HttpError";
import { DBError, DB_CODES } from "./DBError";
import { GuardError, GUARD_CODES } from "./GuardError";
import { CoreError, CORE_CODES } from "./AppError";
import { RouterError, ROUTER_CODES } from "./RouterError";
import { HTTPException } from "hono/http-exception";
import { VALIDATION_CODES, ValidationError } from "./ValidationError";

// ============================================================================
// MERGED CODES
// ============================================================================

export const ERR_CODES = {
  ...CORE_CODES,
  ...DI_CODES,
  ...HTTP_CODES,
  ...DB_CODES,
  ...GUARD_CODES,
  ...ROUTER_CODES,
  ...VALIDATION_CODES,
} as const;

// ============================================================================
// ERR - CALLABLE + ALL METHODS
// ============================================================================

type ErrFn = {
  (message: string, status?: number): never;
  (status: number, message: string): never;
};

const throwHttp = (message: string, status = 400): never => {
  throw new BaseError(`HTTP_${status}`, message, status);
};

export const Err = Object.assign(
  // Callable: Err(msg), Err(msg, 404), Err(404, msg)
  ((first: string | number, second?: string | number): never => {
    if (typeof first === "number") return throwHttp(second as string, first);
    return throwHttp(first, (second as number) ?? 400);
  }) as ErrFn,

  {
    // ========== ALL ERROR FACTORIES ==========
    ...CoreError,
    ...DIError,
    ...HttpError,
    ...DBError,
    ...GuardError,
    ...RouterError,
    ...ValidationError,
    // ========== TYPE GUARDS ==========
    is: BaseError.is,
    hasCode: BaseError.hasCode,
    from: BaseError.from,

    // ========== DOMAIN CHECKS ==========
    isDI: (e: unknown) => BaseError.is(e) && e.code.startsWith("DI_"),
    isHttp: (e: unknown) => BaseError.is(e) && e.code.startsWith("HTTP_"),
    isDB: (e: unknown) => BaseError.is(e) && e.code.startsWith("DB_"),
    isCore: (e: unknown) => BaseError.is(e) && e.code.startsWith("CORE_"),
    isRouter: (e: unknown) => BaseError.is(e) && e.code.startsWith("ROUTER_"),
    isValidation: (e: unknown) => ValidationError.is(e),
    // ========== STATUS CHECKS ==========
    is4xx: (e: unknown) => BaseError.is(e) && e.status! >= 400 && e.status! < 500,
    is5xx: (e: unknown) => BaseError.is(e) && e.status! >= 500,

    // ========== RESPONSE HANDLER ==========
    handle(error: unknown): Response {
      if (BaseError.is(error)) {
        return error.toResponse();
      }

      if (error instanceof HTTPException) {
        return new BaseError(`HTTP_${error.status}`, error.message, error.status).toResponse();
      }

      const message = error instanceof Error ? error.message : String(error);
      return new BaseError("HTTP_500", message, 500).toResponse();
    },

    // ========== WRAP (without throwing) ==========
    wrap(error: unknown, fallbackStatus = 500): BaseError {
      return BaseError.from(error, fallbackStatus);
    },
  }
);

// ============================================================================
// TYPES
// ============================================================================

export type ErrType = typeof Err;
export type ErrCode = (typeof ERR_CODES)[keyof typeof ERR_CODES];

// Re-export for convenience
export { BaseError };
export { GuardError, GUARD_CODES } from './GuardError';
export { RouterError, ROUTER_CODES } from './RouterError';
export { HttpError, HTTP_CODES } from './HttpError';
export { DBError, DB_CODES } from './DBError';
export { CoreError, CORE_CODES } from './AppError';
export { ValidationError, VALIDATION_CODES } from './ValidationError';
