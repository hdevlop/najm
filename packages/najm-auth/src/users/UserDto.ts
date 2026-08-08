import { z } from 'zod';

// Field validations
const emailField = z.string().email('Invalid email format');
// Complexity mirrors UserValidator.validatePasswordStrength so weak passwords
// are rejected uniformly at the edge (422) instead of deep in the service.
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt silently truncates at 72 bytes, so anything past that is not just
  // ignored — two distinct long passwords sharing a 72-byte prefix would verify
  // interchangeably. Cap on byte length (not char count) to keep the whole
  // password significant.
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'Password must be at most 72 bytes')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number');
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

// Public self-registration. Deliberately NARROWER than createUserDto: it must
// NOT accept roleId, status, or emailVerified. Those are privileged fields —
// allowing them here lets an unauthenticated caller self-assign an admin role
// (role IDs are deterministic, e.g. `role_admin`) or self-activate/verify.
// Role/status/verification are set only via the admin `/users` and `/invite`
// routes.
export const registerDto = z.object({
  name: z.string().max(100).optional(),
  email: emailField,
  password: passwordField,
  image: z.string().nullish(),
});

// Invite flow: admin creates the account, the user sets their own password
// via an emailed link — so no password is supplied here.
export const inviteUserDto = z.object({
  name: z.string().max(100).optional(),
  email: emailField,
  roleId: z.string().min(1).optional(),
  image: z.string().nullish(),
});

export const userIdParam = z.object({
  id: z.string().min(1, 'User ID is required'),
});

const identifierField = z.string().trim().min(1).max(254);

// Login verifies an existing hash — it must not re-apply creation-time strength
// rules. A password set before the policy changed, or a temporary credential
// issued by provisioning, would otherwise be rejected at the edge before
// authentication ever runs. Only the bounds that make a comparison meaningful
// are enforced here.
const loginCredentialField = z
  .string()
  .min(1, 'Password is required')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'Password must be at most 72 bytes');

// `email` remains supported for existing consumers. New consumers may submit
// `identifier` with either an email address or an international phone number.
export const loginDto = z.union([
  z.object({
    identifier: identifierField,
    password: loginCredentialField,
    rememberMe: z.boolean().optional(),
  }),
  z.object({
    email: emailField,
    password: loginCredentialField,
    rememberMe: z.boolean().optional(),
  }),
]);

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

export const userListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Inferred types
export type CreateUserDto = z.infer<typeof createUserDto>;
export type UpdateUserDto = z.infer<typeof updateUserDto>;
export type RegisterDto = z.infer<typeof registerDto>;
export type InviteUserDto = z.infer<typeof inviteUserDto>;
export type UserIdParam = z.infer<typeof userIdParam>;
export type LoginDto = z.infer<typeof loginDto>;
export type ChangePasswordDto = z.infer<typeof changePasswordDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
export type ConfirmResetPasswordDto = z.infer<typeof confirmResetPasswordDto>;
export type LanguageParam = z.infer<typeof languageParam>;
export type EmailParam = z.infer<typeof emailParam>;
export type UserIdInParam = z.infer<typeof userIdInParam>;
export type AssignRoleParams = z.infer<typeof assignRoleParams>;
export type UserListQuery = z.infer<typeof userListQuery>;
