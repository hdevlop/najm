import { z } from 'zod';

// Field validations
const emailField = z.string().email('Invalid email format');
const passwordField = z.string().min(8, 'Password must be at least 8 characters');
const optionalDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').nullable().optional();

// DTOs for user operations
export const createUserDto = z.object({
  name: z.string().max(100).optional(),
  email: emailField,
  password: passwordField,
  roleId: z.string().min(1).optional(),
  image: z.string().nullish(),
  emailVerified: z.boolean().default(false),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
});

export const updateUserDto = createUserDto.partial();

export const userIdParam = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export const loginDto = z.object({
  email: emailField,
  password: passwordField,
});

export const changePasswordDto = z.object({
  currentPassword: passwordField,
  newPassword: passwordField,
});

export const resetPasswordDto = z.object({
  email: emailField,
});

export const confirmResetPasswordDto = z.object({
  token: z.string().min(10, 'Invalid reset token'),
  newPassword: passwordField,
});

export const languageParam = z.object({
  language: z.string().min(2),
});

export const emailParam = z.object({
  email: emailField,
});

export const userIdInParam = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const assignRoleParams = z.object({
  userId: z.string().min(1, 'User ID is required'),
  roleId: z.string().min(1),
});

// Inferred types
export type CreateUserDto = z.infer<typeof createUserDto>;
export type UpdateUserDto = z.infer<typeof updateUserDto>;
export type UserIdParam = z.infer<typeof userIdParam>;
export type LoginDto = z.infer<typeof loginDto>;
export type ChangePasswordDto = z.infer<typeof changePasswordDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
export type ConfirmResetPasswordDto = z.infer<typeof confirmResetPasswordDto>;
export type LanguageParam = z.infer<typeof languageParam>;
export type EmailParam = z.infer<typeof emailParam>;
export type UserIdInParam = z.infer<typeof userIdInParam>;
export type AssignRoleParams = z.infer<typeof assignRoleParams>;
