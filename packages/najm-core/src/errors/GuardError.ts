import { BaseError } from "diject";

export const GUARD_CODES = {
  INVALID_CONFIGURATION: "GUARD_001",
  INVALID_METHOD: "GUARD_002",
  ACCESS_DENIED: "GUARD_003",
  EXECUTION_FAILED: "GUARD_004",
} as const;


export const GuardError = {
  invalidConfiguration: (reason: string): never => {
    throw new BaseError(GUARD_CODES.INVALID_CONFIGURATION, `Invalid guard configuration: ${reason}`);
  },

  invalidMethod: (instance: any, methodName: string, guardClassName = "anonymous"): never => {
    throw new BaseError(GUARD_CODES.INVALID_METHOD, `Guard "${guardClassName}" does not have a valid "${methodName}" method`);
  },

  accessDenied: (reason?: string): never => {
    const message = reason ? `Access denied: ${reason}` : "Access denied";
    throw new BaseError(GUARD_CODES.ACCESS_DENIED, message, 403);
  },

  executionFailed: (guardName: string): never => {
    throw new BaseError(GUARD_CODES.EXECUTION_FAILED, `Guard "${guardName}" execution failed`);
  },
};