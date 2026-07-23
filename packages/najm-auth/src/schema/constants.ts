// Shared constants for authentication schemas across all database dialects

export const USER_STATUS = ['active', 'inactive', 'pending'] as const;
export const TOKEN_STATUS = ['active', 'revoked', 'expired'] as const;
export const TOKEN_TYPE = ['access', 'refresh'] as const;

export type UserStatus = (typeof USER_STATUS)[number];
export type TokenStatus = (typeof TOKEN_STATUS)[number];
export type TokenType = (typeof TOKEN_TYPE)[number];
