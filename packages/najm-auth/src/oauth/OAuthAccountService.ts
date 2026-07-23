import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from 'najm-core';
import { Transaction } from 'najm-database';
import { AUTH_CONFIG } from '../auth.tokens';
import type { AuthConfig } from '../types';
import { UserService, type SanitizedUser } from '../users/UserService';
import { OAuthAccountRepository } from './OAuthAccountRepository';
import type { GoogleIdentity } from './types';
import { OAuthFlowError } from './types';

@Injectable()
export class OAuthAccountService {
  @Inject(AUTH_CONFIG) private config!: AuthConfig;

  constructor(
    private accounts: OAuthAccountRepository,
    private users: UserService,
  ) { }

  @Transaction()
  async resolveForLogin(identity: GoogleIdentity): Promise<SanitizedUser> {
    const linked = await this.accounts.getByProviderAccount('google', identity.providerAccountId);
    if (linked) return this.users.getById(linked.userId);

    const existingUser = await this.users.findByEmailInsensitive(identity.email);
    if (existingUser) {
      if (!this.googleConfig().autoLinkVerifiedEmail) {
        throw new OAuthFlowError('oauth_account_link_required', 409);
      }
      await this.createLink(existingUser.id, identity);
      return this.users.getById(existingUser.id);
    }

    if (!this.googleConfig().allowSignup) {
      throw new OAuthFlowError('oauth_signup_disabled', 403);
    }

    const password = `${randomBytes(32).toString('base64url')}Aa1`;
    const user = await this.users.create({
      name: identity.name,
      email: identity.email,
      password,
      image: identity.picture,
      emailVerified: true,
    });
    await this.createLink(user.id, identity);
    return this.users.getById(user.id);
  }

  @Transaction()
  async linkUser(userId: string, identity: GoogleIdentity): Promise<SanitizedUser> {
    const user = await this.users.getById(userId);
    if (user.status !== 'active') throw new OAuthFlowError('oauth_account_inactive', 403);

    const providerAccount = await this.accounts.getByProviderAccount('google', identity.providerAccountId);
    if (providerAccount && providerAccount.userId !== userId) {
      throw new OAuthFlowError('oauth_provider_account_linked', 409);
    }
    if (providerAccount) return user;

    const userProvider = await this.accounts.getByUserProvider(userId, 'google');
    if (userProvider && userProvider.providerAccountId !== identity.providerAccountId) {
      throw new OAuthFlowError('oauth_user_provider_linked', 409);
    }
    if (!userProvider) await this.createLink(userId, identity);
    return user;
  }

  private async createLink(userId: string, identity: GoogleIdentity): Promise<void> {
    const created = await this.accounts.create({
      userId,
      provider: 'google',
      providerAccountId: identity.providerAccountId,
    });
    if (created) return;

    const linked = await this.accounts.getByProviderAccount('google', identity.providerAccountId);
    if (!linked || linked.userId !== userId) {
      throw new OAuthFlowError('oauth_provider_account_linked', 409);
    }
  }

  private googleConfig() {
    const google = this.config.oauth?.google;
    if (!google) throw new OAuthFlowError('oauth_provider_disabled', 404);
    return google;
  }
}
