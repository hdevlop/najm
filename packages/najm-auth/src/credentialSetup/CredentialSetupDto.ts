import { z } from 'zod';

/**
 * Default replacement-password policy for the built-in `password` setup flow.
 *
 * Deliberately looser than `passwordField` on one axis: no uppercase
 * requirement. A first-login replacement is typed by someone who just proved
 * they hold the temporary credential, often on a phone keyboard, and forcing a
 * shift key there buys nothing that length and a digit do not.
 */
export const defaultCredentialSetupPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'Password must be at most 72 bytes')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

/**
 * Edge shape only — bounds, not policy. The configured policy schema is applied
 * in the service, because it comes from `auth({ credentialSetup })`.
 */
export const credentialSetupChangeDto = z.object({
  newPassword: z.string().min(1, 'A new password is required').max(256),
});

export type CredentialSetupChangeDto = z.infer<typeof credentialSetupChangeDto>;
