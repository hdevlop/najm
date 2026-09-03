import { EncryptionService } from './EncryptionService';
import { CookieManager } from './CookieManager';
import { AuthController } from './AuthController';
import { AuthService } from './AuthService';
import { AuthGuard } from './AuthGuard';
import { AuthResolver } from './AuthResolver';
import { AuthSessionService } from './AuthSessionService';
import { AuthIdentityContextService } from './AuthIdentityContextService';
import { RegistrationController } from './RegistrationController';

export * from './EncryptionService';
export * from './CookieManager';
export * from './AuthController';
export * from './AuthService';
export * from './AuthGuard';
export * from './AuthResolver';
export * from './AuthSessionService';
export * from './RegistrationController';
export * from './authIdentity';
export * from './authLoginRateLimitConfig';
export { runAsUser } from './runAsUser';
export type { RunAsUser } from './runAsUser';

export const AUTH_CORE_MODULE = [
  AuthService,
  AuthSessionService,
  CookieManager,
  EncryptionService,
  AuthGuard,
  AuthController,
  AuthResolver,
  AuthIdentityContextService,
] as const;

export const PUBLIC_REGISTRATION_MODULE = [RegistrationController] as const;

/** Full module retained for consumers that register the exported module directly. */
export const AUTH_MODULE = [
  ...AUTH_CORE_MODULE,
  ...PUBLIC_REGISTRATION_MODULE,
] as const;
