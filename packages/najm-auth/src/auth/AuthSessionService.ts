import { Injectable } from 'najm-core';
import { Err } from 'najm-core';
import { CookieManager } from './CookieManager';
import { TokenService } from '../tokens/TokenService';
import { UserService, type SanitizedUser } from '../users/UserService';
import { CredentialSetupRequirementService } from '../credentialSetup/CredentialSetupRequirementService';
import { CREDENTIAL_SETUP_CODES, credentialSetupError } from '../credentialSetup/errors';
import { PASSWORD_SETUP_PURPOSE } from '../credentialSetup/types';
import type { TokenPair } from '../types';

@Injectable()
export class AuthSessionService {
  constructor(
    private tokenService: TokenService,
    private userService: UserService,
    private cookieManager: CookieManager,
    private credentialSetupRequirements?: CredentialSetupRequirementService,
  ) { }

  async establish(user: SanitizedUser): Promise<TokenPair & { user: SanitizedUser }> {
    if (user.status !== 'active') {
      Err('oauth_account_inactive', 403);
    }

    // Central chokepoint: every path that would mint a normal session goes
    // through here, so one check covers password login, OAuth, and anything an
    // application adds later.
    if (await this.credentialSetupRequirements?.isRequired(user.id, PASSWORD_SETUP_PURPOSE)) {
      credentialSetupError(
        CREDENTIAL_SETUP_CODES.REQUIRED,
        'Credential setup is required before a session can be established',
        403,
      );
    }

    await this.tokenService.deleteExpiredSessions();

    const generated = await this.tokenService.generateTokens(user.id);
    this.cookieManager.setRefreshToken(generated.refreshToken);
    await this.userService.updateLastLogin(user.id);

    const { roles, permissions, sessionVersion, tokenFamily } = generated;
    this.cookieManager.setSessionCookie({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role ?? undefined,
        status: user.status ?? undefined,
      },
      roles,
      permissions,
      sessionVersion,
      tokenFamily,
    });

    const {
      userId: _userId,
      tokenFamily: _tokenFamily,
      roles: _roles,
      permissions: _permissions,
      sessionVersion: _sessionVersion,
      ...tokens
    } = generated;

    return { ...tokens, user };
  }
}
