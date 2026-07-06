import { BaseError } from "diject";

// ============================================================================
// ROUTER ERROR CODES
// ============================================================================

export const ROUTER_CODES = {
  INVALID_CONFIG: "ROUTER_001",
  ROUTE_NOT_FOUND: "ROUTER_002",
  METHOD_NOT_ALLOWED: "ROUTER_003",
  DUPLICATE_ROUTE: "ROUTER_004",
  INVALID_HANDLER: "ROUTER_005",
  REGISTRATION_FAILED: "ROUTER_006",
} as const;

const getCauseMessage = (cause: unknown): string | undefined => {
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause;
  return undefined;
};

const withCause = (error: BaseError, cause?: unknown): BaseError => {
  if (cause !== undefined) {
    (error as BaseError & { cause?: unknown }).cause = cause;
  }
  return error;
};

// ============================================================================
// ROUTER ERROR FACTORY
// ============================================================================

export const RouterError = {
  invalidConfig: (route: string, reason: string): never => {
    throw new BaseError(
      ROUTER_CODES.INVALID_CONFIG,
      `Invalid route configuration for "${route}": ${reason}`,
      500
    );
  },

  routeNotFound: (path: string, method: string): never => {
    throw new BaseError(
      ROUTER_CODES.ROUTE_NOT_FOUND,
      `Route not found: ${method} ${path}`,
      404
    );
  },

  methodNotAllowed: (path: string, method: string, allowed: string[]): never => {
    throw new BaseError(
      ROUTER_CODES.METHOD_NOT_ALLOWED,
      `Method ${method} not allowed for ${path}. Allowed: ${allowed.join(", ")}`,
      405
    );
  },

  duplicateRoute: (path: string, method: string): never => {
    throw new BaseError(
      ROUTER_CODES.DUPLICATE_ROUTE,
      `Duplicate route: ${method} ${path}`,
      500
    );
  },

  invalidHandler: (controller: string, method: string): never => {
    throw new BaseError(
      ROUTER_CODES.INVALID_HANDLER,
      `Invalid handler: ${controller}.${method} is not a function`,
      500
    );
  },

  registrationFailed: (method: string, path: string, cause?: unknown): never => {
    const causeMessage = getCauseMessage(cause);
    const message = causeMessage
      ? `Failed to register route: ${method} ${path}: ${causeMessage}`
      : `Failed to register route: ${method} ${path}`;

    throw withCause(new BaseError(
      ROUTER_CODES.REGISTRATION_FAILED,
      message,
      500,
    ), cause);
  },
};
