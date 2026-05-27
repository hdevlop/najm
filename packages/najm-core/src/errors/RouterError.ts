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

  registrationFailed: (method: string, path: string): never => {
    throw new BaseError(
      ROUTER_CODES.REGISTRATION_FAILED,
      `Failed to register route: ${method} ${path}`,
      500,
    );
  },
};