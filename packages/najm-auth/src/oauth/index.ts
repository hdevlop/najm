import { GoogleOAuthProvider } from './google/GoogleOAuthProvider';
import { GoogleTokenVerifier } from './google/GoogleTokenVerifier';
import { GitHubOAuthProvider } from './github/GitHubOAuthProvider';
import { GitHubOAuthController } from './GitHubOAuthController';
import { OAuthAccountRepository } from './OAuthAccountRepository';
import { OAuthAccountService } from './OAuthAccountService';
import { OAuthController } from './OAuthController';
import { OAuthService } from './OAuthService';
import { OAuthStateService } from './OAuthStateService';

export type {
  GitHubIdentity,
  GoogleIdentity,
  OAuthIdentity,
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
  GitHubOAuthProvider,
  OAuthService,
  OAuthController,
  GitHubOAuthController,
] as const;
