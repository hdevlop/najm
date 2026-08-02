import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { Err, Inject, Repository } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';

type NewSetupSession = {
  userId: string;
  purpose: string;
  tokenHash: string;
  expiresAt: string;
};

@Repository()
export class CredentialSetupRepository {
  @DB() private db!: TDb;
  @Inject(AUTH_SCHEMA) private schema!: AuthSchema;

  private get sessions() {
    const sessions = this.schema.credentialSetupSessions;
    if (!sessions) {
      Err.invalidOperation(
        'auth.schema.credentialSetupSessions is required to use CredentialSetupService',
      );
    }
    return sessions;
  }

  async replaceActive(data: NewSetupSession) {
    const now = new Date().toISOString();
    await this.db
      .update(this.sessions)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(this.sessions.userId, data.userId),
        eq(this.sessions.purpose, data.purpose),
        isNull(this.sessions.consumedAt),
        isNull(this.sessions.revokedAt),
      ));

    const [session] = await this.db
      .insert(this.sessions)
      .values(data)
      .returning({
        userId: this.sessions.userId,
        purpose: this.sessions.purpose,
        expiresAt: this.sessions.expiresAt,
      });
    return session;
  }

  async findActive(tokenHash: string, purpose: string) {
    const [session] = await this.db
      .select({
        userId: this.sessions.userId,
        purpose: this.sessions.purpose,
        expiresAt: this.sessions.expiresAt,
      })
      .from(this.sessions)
      .where(and(
        eq(this.sessions.tokenHash, tokenHash),
        eq(this.sessions.purpose, purpose),
        isNull(this.sessions.consumedAt),
        isNull(this.sessions.revokedAt),
        gt(this.sessions.expiresAt, new Date().toISOString()),
      ))
      .limit(1);
    return session;
  }

  async consume(tokenHash: string, purpose: string) {
    const now = new Date().toISOString();
    const [session] = await this.db
      .update(this.sessions)
      .set({ consumedAt: now, updatedAt: now })
      .where(and(
        eq(this.sessions.tokenHash, tokenHash),
        eq(this.sessions.purpose, purpose),
        isNull(this.sessions.consumedAt),
        isNull(this.sessions.revokedAt),
        gt(this.sessions.expiresAt, now),
      ))
      .returning({
        userId: this.sessions.userId,
        purpose: this.sessions.purpose,
        expiresAt: this.sessions.expiresAt,
      });
    return session;
  }

  async revoke(tokenHash: string, purpose: string) {
    const now = new Date().toISOString();
    const [session] = await this.db
      .update(this.sessions)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(this.sessions.tokenHash, tokenHash),
        eq(this.sessions.purpose, purpose),
        isNull(this.sessions.consumedAt),
        isNull(this.sessions.revokedAt),
      ))
      .returning({ userId: this.sessions.userId });
    return session;
  }

  async deleteExpired() {
    return this.db
      .delete(this.sessions)
      .where(lt(this.sessions.expiresAt, new Date().toISOString()))
      .returning({ userId: this.sessions.userId });
  }
}
