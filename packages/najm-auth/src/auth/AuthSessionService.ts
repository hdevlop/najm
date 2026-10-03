import { Injectable } from 'najm-core';
import { Err } from 'najm-core';
import { CookieManager } from './CookieManager';
import { TokenService } from '../tokens/TokenService';
import { UserService, type SanitizedUser } from '../users/UserService';
import { CredentialSetupRequirementService } from '../credentialSetup/CredentialSetupRequirementService';
import { CREDENTIAL_SETUP_CODES, credentialSetupError } from '../credentialSetup/errors';
import { PASSWORD_SETUP_PURPOSE } from '../credentialSetup/types';
import type { TokenPair } from '../types';
import { verifiedCredentials } from './verifiedCredential';

@Injectable()
export class AuthSessionService {
  constructor(
    private tokenService: TokenService,
    private userService: UserService,
    private cookieManager: CookieManager,
    private credentialSetupRequirements?: CredentialSetupRequirementService,
  ) { }

  async establish(user: SanitizedUser): Promise<TokenPair & { user: SanitizedUser }> {
    // Read the version BEFORE the authoritative record. Changes during either
    // this read or token storage must invalidate this attempt, never stamp the
    // old authenticated state with the mutation's new version.
    const sessionVersion = await this.tokenService.getSessionVersion(user.id);
    const current = await this.userService.getAuthRecordById(user.id);
    if (!current || current.status !== 'active' || user.status !== 'active') {
      Err('oauth_account_inactive', 403);
    }
    const verifiedHash = verifiedCredentials.get(user);
    if ((verifiedHash !== undefined && verifiedHash !== current.password)
      || (['email', 'phone', 'emailVerified', 'roleId'] as const)
        .some(field => field in user && (user[field] ?? null) !== (current[field] ?? null))) {
      Err('errors.invalidCredentials', 401);
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

    const generated = await this.tokenService.generateTokens(user.id, undefined, sessionVersion);
    await this.userService.updateLastLogin(user.id);
    // The last-login write can also yield to an account change.
    if (await this.tokenService.getSessionVersion(user.id) !== generated.sessionVersion) {
      await this.tokenService.revokeFamily(generated.tokenFamily);
      Err('errors.tokenRevoked', 401);
    }
    this.cookieManager.setRefreshToken(generated.refreshToken);

    const { roles, permissions, tokenFamily } = generated;
    user = { ...user, role: roles[0] ?? null };
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
