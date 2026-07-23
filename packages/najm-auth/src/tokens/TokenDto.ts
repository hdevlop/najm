import { z } from 'zod';

// Field validations
const tokenField = z.string().min(1, 'Token is required');
const userIdField = z.string().length(8, 'User ID must be 8 characters');
const expiresAtField = z.string().datetime('Invalid datetime format');

// DTOs for token operations
export const createTokenDto = z.object({
  userId: userIdField,
  token: tokenField,
  type: z.enum(['access', 'refresh']).default('refresh'),
  status: z.enum(['active', 'revoked', 'expired']).default('active'),
  expiresAt: expiresAtField,
});

export const updateTokenDto = z.object({
  status: z.enum(['active', 'revoked', 'expired']),
});

export const tokenIdParam = z.object({
  id: z.string().length(10, 'Token ID must be 10 characters'),
});

export const verifyTokenDto = z.object({
  token: tokenField,
});

export const refreshTokenDto = z.object({
  refreshToken: tokenField,
});

export const revokeTokenDto = z.object({
  userId: userIdField,
});

// Inferred types
export type CreateTokenDto = z.infer<typeof createTokenDto>;
export type UpdateTokenDto = z.infer<typeof updateTokenDto>;
export type TokenIdParam = z.infer<typeof tokenIdParam>;
export type VerifyTokenDto = z.infer<typeof verifyTokenDto>;
export type RefreshTokenDto = z.infer<typeof refreshTokenDto>;
export type RevokeTokenDto = z.infer<typeof revokeTokenDto>;
