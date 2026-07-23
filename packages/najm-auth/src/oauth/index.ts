import { GoogleOAuthProvider } from './google/GoogleOAuthProvider';
import { GoogleTokenVerifier } from './google/GoogleTokenVerifier';
import { OAuthAccountRepository } from './OAuthAccountRepository';
import { OAuthAccountService } from './OAuthAccountService';
import { OAuthController } from './OAuthController';
import { OAuthService } from './OAuthService';
import { OAuthStateService } from './OAuthStateService';

export type {
  GoogleIdentity,
  OAuthAttempt,
  OAuthCallbackParams,
  OAuthIntent,
} from './types';
export type { OAuthStartQuery, OAuthCallbackQuery } from './OAuthDto';

export const OAUTH_MODULE = [
  OAuthAccountRepository,
  OAuthAccountService,
  OAuthStateService,
  GoogleTokenVerifier,
  GoogleOAuthProvider,
  OAuthService,
  OAuthController,
] as const;
