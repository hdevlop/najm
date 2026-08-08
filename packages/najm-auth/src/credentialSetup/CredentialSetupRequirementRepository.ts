import { and, eq } from 'drizzle-orm';
import { Err, Inject, Repository } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { AUTH_SCHEMA } from '../auth.tokens';
import type { AuthSchema } from '../types';
import type { CredentialSetupRequirementRow } from './types';

@Repository()
export class CredentialSetupRequirementRepository {
  @DB() private db!: TDb;
  @Inject(AUTH_SCHEMA) private schema!: AuthSchema;

  private get requirements() {
    const requirements = this.schema.credentialSetupRequirements;
    if (!requirements) {
      Err.invalidOperation(
        'auth.schema.credentialSetupRequirements is required for credential-setup requirements',
      );
    }
    return requirements;
  }

  private get columns() {
    const requirements = this.requirements;
    return {
      userId: requirements.userId,
      purpose: requirements.purpose,
      temporaryCredentialKind: requirements.temporaryCredentialKind,
      required: requirements.required,
      completedAt: requirements.completedAt,
    };
  }

  async markRequired(
    userId: string,
    purpose: string,
    temporaryCredentialKind: string | null,
  ): Promise<CredentialSetupRequirementRow> {
    const now = new Date().toISOString();
    const [requirement] = await this.db
      .insert(this.requirements)
      .values({ userId, purpose, temporaryCredentialKind, required: true })
      .onConflictDoUpdate({
        target: [this.requirements.userId, this.requirements.purpose],
        set: { temporaryCredentialKind, required: true, completedAt: null, updatedAt: now },
      })
      .returning(this.columns);
    return requirement;
  }

  async find(userId: string, purpose: string): Promise<CredentialSetupRequirementRow | undefined> {
    const [requirement] = await this.db
      .select(this.columns)
      .from(this.requirements)
      .where(and(
        eq(this.requirements.userId, userId),
        eq(this.requirements.purpose, purpose),
      ))
      .limit(1);
    return requirement;
  }

  async listRequired(userId: string): Promise<CredentialSetupRequirementRow[]> {
    return this.db
      .select(this.columns)
      .from(this.requirements)
      .where(and(
        eq(this.requirements.userId, userId),
        eq(this.requirements.required, true),
      ));
  }

  /** Only a still-required row completes, so a replayed completion is a no-op. */
  async complete(userId: string, purpose: string): Promise<CredentialSetupRequirementRow | undefined> {
    const now = new Date().toISOString();
    const [requirement] = await this.db
      .update(this.requirements)
      .set({ required: false, completedAt: now, updatedAt: now })
      .where(and(
        eq(this.requirements.userId, userId),
        eq(this.requirements.purpose, purpose),
        eq(this.requirements.required, true),
      ))
      .returning(this.columns);
    return requirement;
  }
}
