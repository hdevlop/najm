import { and, eq, isNull, lt } from 'drizzle-orm';
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

  /** Shared query helper, scoped to the current database/transaction identity. */
  private queryHelper?: { db: TDb; queries: AuthQueries };
  private get q() {
    const db = this.db;
    if (this.queryHelper?.db !== db) {
      this.queryHelper = { db, queries: new AuthQueries(db, this.schema) };
    }
    return this.queryHelper.queries;
  }

  /**
   * Upsert the refresh-token row for a session, keyed on `tokenFamily` (the
   * per-login session identifier, unique). A brand-new login inserts a fresh
   * family row; a refresh rotation updates only that family's row, leaving the
   * user's other sessions untouched.
   */
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
        target: this.tokens.tokenFamily,
        set: {
          token: tokenData.token,
          expiresAt: tokenData.expiresAt,
          previousHash: tokenData.previousHash ?? null,
          previousValidUntil: tokenData.previousValidUntil ?? null,
          previousUsedAt: tokenData.previousUsedAt ?? null,
        }
      }).returning();
  }

  /**
   * Rotate an existing refresh-token family with compare-and-swap semantics.
   * This can never insert a family deleted by a concurrent logout.
   */
  async rotateRefreshToken(tokenData: {
    userId: string;
    token: string;
    tokenFamily: string;
    expiresAt: string;
    previousHash: string;
    previousValidUntil: string;
    previousUsedAt?: string | null;
  }, expectedCurrentHash: string) {
    return await this.db
      .update(this.tokens)
      .set({
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        previousHash: tokenData.previousHash,
        previousValidUntil: tokenData.previousValidUntil,
        previousUsedAt: tokenData.previousUsedAt ?? null,
      })
      .where(and(
        eq(this.tokens.tokenFamily, tokenData.tokenFamily),
        eq(this.tokens.userId, tokenData.userId),
        eq(this.tokens.token, expectedCurrentHash),
      ))
      .returning();
  }

  /**
   * Claim the previous-token grace slot for a single family. Conditional on
   * BOTH the stored previousHash still matching the presented token AND
   * previousUsedAt being NULL. Gating on the hash (not just the flag) closes
   * the rotation race: the winner's rotation rewrites previousHash via
   * storeRefreshToken (and resets previousUsedAt to NULL), so a loser whose
   * UPDATE lands after that rotation no longer matches and gets zero rows —
   * exactly one caller ever claims the slot.
   */
  async markPreviousUsed(tokenFamily: string, previousHash: string) {
    return await this.db
      .update(this.tokens)
      .set({ previousUsedAt: new Date().toISOString() })
      .where(and(
        eq(this.tokens.tokenFamily, tokenFamily),
        eq(this.tokens.previousHash, previousHash),
        isNull(this.tokens.previousUsedAt),
      ))
      .returning();
  }

  /** Look up a single session's token row by its family identifier. */
  async getByFamily(tokenFamily: string) {
    const [token] = await this.db.select().from(this.tokens).where(eq(this.tokens.tokenFamily, tokenFamily));
    return token ?? null;
  }

  /** Revoke a single session (one family). */
  async revokeFamily(tokenFamily: string) {
    return this.db.delete(this.tokens).where(eq(this.tokens.tokenFamily, tokenFamily)).returning();
  }

  /** Revoke every session for a user (password change/reset, logout-all). */
  async revokeAllForUser(userId: string) {
    return this.db.delete(this.tokens).where(eq(this.tokens.userId, userId)).returning();
  }

  /**
   * Opportunistic cleanup: with one row per family (no unique userId), expired
   * and abandoned sessions accumulate. Delete every expired row.
   */
  async deleteExpired() {
    return this.db.delete(this.tokens).where(lt(this.tokens.expiresAt, new Date().toISOString())).returning();
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
