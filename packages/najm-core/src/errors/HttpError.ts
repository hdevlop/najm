import { BaseError } from "diject";

// ============================================================================
// HTTP ERROR CODES
// ============================================================================

export const HTTP_CODES = {
  // 4xx Client Errors
  BAD_REQUEST: "HTTP_400",
  UNAUTHORIZED: "HTTP_401",
  FORBIDDEN: "HTTP_403",
  NOT_FOUND: "HTTP_404",
  METHOD_NOT_ALLOWED: "HTTP_405",
  CONFLICT: "HTTP_409",
  GONE: "HTTP_410",
  PAYLOAD_TOO_LARGE: "HTTP_413",
  UNSUPPORTED_MEDIA_TYPE: "HTTP_415",
  UNPROCESSABLE_ENTITY: "HTTP_422",
  TOO_MANY_REQUESTS: "HTTP_429",

  // 5xx Server Errors
  INTERNAL_ERROR: "HTTP_500",
  NOT_IMPLEMENTED: "HTTP_501",
  SERVICE_UNAVAILABLE: "HTTP_503",
} as const;

// ============================================================================
// HTTP ERROR FACTORY
// ============================================================================

const http = (status: number, code: string, message: string): never => {
  throw new BaseError(code, message, status);
};

export const HttpError = {
  // ========== 4xx CLIENT ERRORS ==========

  badRequest: (message = "Bad Request"): never =>
    http(400, HTTP_CODES.BAD_REQUEST, message),

  unauthorized: (message = "Unauthorized"): never =>
    http(401, HTTP_CODES.UNAUTHORIZED, message),

  forbidden: (message = "Forbidden"): never =>
    http(403, HTTP_CODES.FORBIDDEN, message),

  notFound: (message = "Not Found"): never =>
    http(404, HTTP_CODES.NOT_FOUND, message),

  methodNotAllowed: (message = "Method Not Allowed"): never =>
    http(405, HTTP_CODES.METHOD_NOT_ALLOWED, message),

  conflict: (message = "Conflict"): never =>
    http(409, HTTP_CODES.CONFLICT, message),

  gone: (message = "Gone"): never =>
    http(410, HTTP_CODES.GONE, message),

  payloadTooLarge: (message = "Payload Too Large"): never =>
    http(413, HTTP_CODES.PAYLOAD_TOO_LARGE, message),

  unsupportedMediaType: (message = "Unsupported Media Type"): never =>
    http(415, HTTP_CODES.UNSUPPORTED_MEDIA_TYPE, message),

  unprocessableEntity: (message = "Unprocessable Entity"): never =>
    http(422, HTTP_CODES.UNPROCESSABLE_ENTITY, message),

  tooManyRequests: (message = "Too Many Requests"): never =>
    http(429, HTTP_CODES.TOO_MANY_REQUESTS, message),

  // ========== 5xx SERVER ERRORS ==========

  internal: (message = "Internal Server Error"): never =>
    http(500, HTTP_CODES.INTERNAL_ERROR, message),

  notImplemented: (message = "Not Implemented"): never =>
    http(501, HTTP_CODES.NOT_IMPLEMENTED, message),

  serviceUnavailable: (message = "Service Unavailable"): never =>
    http(503, HTTP_CODES.SERVICE_UNAVAILABLE, message),

  // ========== SPECIAL CASES ==========

  validation: (errors: Record<string, any>): never =>
    http(422, HTTP_CODES.UNPROCESSABLE_ENTITY, `Validation failed: ${JSON.stringify(errors)}`),

  // ========== GENERIC ==========

  create: (status: number, message: string): never =>
    http(status, `HTTP_${status}`, message),

  // ========== ALIASES (for convenience) ==========

  tooMany: (message = "Too Many Requests"): never =>
    http(429, HTTP_CODES.TOO_MANY_REQUESTS, message),

  unavailable: (message = "Service Unavailable"): never =>
    http(503, HTTP_CODES.SERVICE_UNAVAILABLE, message),
};
