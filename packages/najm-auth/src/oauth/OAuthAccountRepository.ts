import { and, eq } from 'drizzle-orm';
import { Inject, Repository } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import type { NewOAuthAccount, OAuthAccount } from '../schema/pg';
import { OAuthFlowError } from './types';

@Repository()
export class OAuthAccountRepository {
  @DB() private db!: TDb;
  @Inject(AUTH_SCHEMA) private schema!: AuthSchema;

  private get accounts() {
    if (!this.schema.oauthAccounts) {
      throw new OAuthFlowError('oauth_schema_missing', 500);
    }
    return this.schema.oauthAccounts;
  }

  async getByProviderAccount(provider: string, providerAccountId: string): Promise<OAuthAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(this.accounts)
      .where(and(
        eq(this.accounts.provider, provider),
        eq(this.accounts.providerAccountId, providerAccountId),
      ))
      .limit(1);
    return account as OAuthAccount | undefined;
  }

  async getByUserProvider(userId: string, provider: string): Promise<OAuthAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(this.accounts)
      .where(and(
        eq(this.accounts.userId, userId),
        eq(this.accounts.provider, provider),
      ))
      .limit(1);
    return account as OAuthAccount | undefined;
  }

  async create(data: NewOAuthAccount): Promise<OAuthAccount | undefined> {
    const [account] = await this.db
      .insert(this.accounts)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return account as OAuthAccount | undefined;
  }
}
