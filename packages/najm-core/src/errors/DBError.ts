import { BaseError } from "diject";

export const DB_CODES = {
  CONNECTION_FAILED: "DB_001",
  QUERY_FAILED: "DB_002",
  TRANSACTION_FAILED: "DB_003",
  NOT_FOUND: "DB_004",
  ALREADY_REGISTERED: "DB_005",
  DISCONNECT_FAILED: "DB_006",
  TRANSACTION_ABORTED: "DB_007",
  DUPLICATE_ENTRY: "DB_008",
  INVALID_NAME: "DB_009",
  MISSING_INJECTIONS: "DB_010",
} as const;

export const DBError = {
  connectionFailed: (name: string): BaseError => {
    throw new BaseError(
      DB_CODES.CONNECTION_FAILED,
      `Failed to connect database '${name}'`
    );
  },

  queryFailed: (query: string): BaseError => {
    const truncated = query.substring(0, 100);
    throw new BaseError(
      DB_CODES.QUERY_FAILED,
      `Database query failed: ${truncated}${query.length > 100 ? "..." : ""}`
    );
  },

  transactionFailed: (): BaseError => {
    throw new BaseError(
      DB_CODES.TRANSACTION_FAILED,
      "Database transaction failed"
    );
  },

  dbNotFound: (name: string, available: string[]): BaseError => {
    const suggestion =
      available.length > 0
        ? ` Available: ${available.join(", ")}`
        : " No databases registered.";
    throw new BaseError(
      DB_CODES.NOT_FOUND,
      `Database '${name}' not found.${suggestion}`
    );
  },

  alreadyRegistered: (name: string): BaseError => {
    throw new BaseError(
      DB_CODES.ALREADY_REGISTERED,
      `Database '${name}' already registered`
    );
  },

  disconnectFailed: (name: string): BaseError => {
    throw new BaseError(
      DB_CODES.DISCONNECT_FAILED,
      `Failed to disconnect database '${name}'`
    );
  },

  transactionAborted: (reason: string): BaseError => {
    throw new BaseError(
      DB_CODES.TRANSACTION_ABORTED,
      `Transaction aborted: ${reason}`
    );
  },

  duplicateEntry: (entity: string, field: string): BaseError => {
    throw new BaseError(
      DB_CODES.DUPLICATE_ENTRY,
      `Duplicate entry for ${entity}.${field}`
    );
  },

  dbInvalidName: (name: string, reason: string): BaseError => {
    throw new BaseError(
      DB_CODES.INVALID_NAME,
      `Invalid database name: ${reason}`
    );
  },

  missingInjections: (missing: string[], available: string[]): BaseError => {
    throw new BaseError(
      DB_CODES.MISSING_INJECTIONS,
      `Missing database injections: ${missing.join(", ")}. Available: ${available.join(", ")}`
    );
  },
};