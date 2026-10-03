import { createHmac } from 'node:crypto';
import type { User } from '../schema/pg';

export type CredentialState = Pick<User, 'id' | 'password' | 'email' | 'status' | 'emailVerified'>;

/** Bind recovery to account state without putting the stored password hash in a JWT. */
export function credentialFingerprint(secret: string, user: CredentialState): string {
  return createHmac('sha256', secret)
    .update('najm:set-password:v1:')
    .update(JSON.stringify([user.id, user.password, user.email, user.status, user.emailVerified]))
    .digest('base64url');
}
