import { Injectable } from 'najm-core';
import { Transaction } from 'najm-database';
import { resolveTemporaryCredentialKind } from '../identity/temporaryCredential';
import { TokenService } from '../tokens/TokenService';
import { CredentialSetupRequirementRepository } from './CredentialSetupRequirementRepository';
import { normalizeSetupPurpose } from './purpose';
import type { CredentialSetupRequirementRow } from './types';

/**
 * The durable half of credential setup: what a user still owes, independent of
 * any browser. `CredentialSetupService` owns the other half — the short-lived
 * cookie session that lets one browser satisfy it.
 */
@Injectable()
export class CredentialSetupRequirementService {
  constructor(
    private readonly repository: CredentialSetupRequirementRepository,
    private readonly tokens: TokenService,
  ) { }

  /**
   * Idempotent. Re-marking clears a previous completion, and revokes the
   * user's current sessions so an already signed-in browser cannot skip it.
   */
  @Transaction({ retries: 2 })
  async markRequired(
    userId: string,
    purpose: string,
    options: { temporaryCredentialKind?: string | null } = {},
  ): Promise<CredentialSetupRequirementRow> {
    const kind = options.temporaryCredentialKind ?? null;
    // Fail closed here rather than at the next login of a user we can no
    // longer authenticate.
    if (kind) resolveTemporaryCredentialKind(kind);

    const requirement = await this.repository.markRequired(
      userId,
      normalizeSetupPurpose(purpose),
      kind,
    );

    await this.tokens.invalidateUserAccessTokens(userId);
    await this.tokens.revokeAllForUser(userId);

    return requirement;
  }

  async find(userId: string, purpose: string): Promise<CredentialSetupRequirementRow | undefined> {
    const requirement = await this.repository.find(userId, normalizeSetupPurpose(purpose));
    return requirement?.required ? requirement : undefined;
  }

  async isRequired(userId: string, purpose: string): Promise<boolean> {
    return Boolean(await this.find(userId, purpose));
  }

  async listRequired(userId: string): Promise<CredentialSetupRequirementRow[]> {
    return this.repository.listRequired(userId);
  }

  /** Returns the completed row, or `undefined` when nothing was still required. */
  async completeRequirement(
    userId: string,
    purpose: string,
  ): Promise<CredentialSetupRequirementRow | undefined> {
    return this.repository.complete(userId, normalizeSetupPurpose(purpose));
  }
}
