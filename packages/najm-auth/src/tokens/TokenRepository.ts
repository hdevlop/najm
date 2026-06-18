import { and, eq, isNull } from 'drizzle-orm';
import { Repository, Inject } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import { AuthQueries } from '../shared/queries';

@Repository()
export class TokenRepository {
  @DB() db: TDb;
  @Inject(AUTH_SCHEMA) private schema: AuthSchema;

  private get tokens() { return this.schema.tokens; }
  private get users() { return this.schema.users; }

  /** Shared query helper */
  private queryHelper?: AuthQueries;
  private get q() { return this.queryHelper ??= new AuthQueries(this.db, this.schema); }

  async storeRefreshToken(tokenData: {
    userId: string;
    token: string;
    tokenFamily: string;
    expiresAt: string;
    previousHash?: string | null;
    previousValidUntil?: string | null;
    previousUsedAt?: string | null;
  }) {
    return await this.db
      .insert(this.tokens)
      .values(tokenData)
      .onConflictDoUpdate({
        target: this.tokens.userId,
        set: {
          token: tokenData.token,
          tokenFamily: tokenData.tokenFamily,
          expiresAt: tokenData.expiresAt,
          previousHash: tokenData.previousHash ?? null,
          previousValidUntil: tokenData.previousValidUntil ?? null,
          previousUsedAt: tokenData.previousUsedAt ?? null,
        }
      }).returning();
  }

  /**
   * Claim the previous-token grace slot. Conditional on BOTH the stored
   * previousHash still matching the presented token AND previousUsedAt being
   * NULL. Gating on the hash (not just the flag) closes the rotation race: the
   * winner's rotation rewrites previousHash via storeRefreshToken, so a loser
   * whose UPDATE lands after that rotation no longer matches and gets zero
   * rows — exactly one caller ever claims the slot.
   */
  async markPreviousUsed(userId: string, previousHash: string) {
    return await this.db
      .update(this.tokens)
      .set({ previousUsedAt: new Date().toISOString() })
      .where(and(
        eq(this.tokens.userId, userId),
        eq(this.tokens.previousHash, previousHash),
        isNull(this.tokens.previousUsedAt),
      ))
      .returning();
  }

  async getRefreshTokenWithFamily(userId: string) {
    const [token] = await this.db.select().from(this.tokens).where(eq(this.tokens.userId, userId));
    return token ?? null;
  }

  async revokeToken(userId: string) {
    const [deletedToken] = await this.db.delete(this.tokens).where(eq(this.tokens.userId, userId)).returning();
    return deletedToken;
  }

  async revokeByFamily(tokenFamily: string) {
    return this.db.delete(this.tokens).where(eq(this.tokens.tokenFamily, tokenFamily)).returning();
  }

  async isUserExists(userId: string) {
    const [user] = await this.db
      .select({ id: this.users.id })
      .from(this.users)
      .where(eq(this.users.id, userId))
      .limit(1);
    return !!user;
  }

  async getRoleNameById(userId: string) {
    return this.q.getRoleName(userId);
  }

  async getUserPermissions(userId: string) {
    return this.q.getUserPermissions(userId);
  }

  async getRoleAndPermissions(userId: string) {
    return this.q.getRoleAndPermissions(userId);
  }

  async getUser(userId: string) {
    return await this.q.getUserWithPermissions(eq(this.users.id, userId)) ?? null;
  }
}
