// ============================================================================
// najm-theme/server — branding domain service
// ============================================================================

import { Inject, Service } from "najm-core";
import { TransactionService } from "najm-database";

import {
  resolveBrandingSlots,
  type AdminBranding,
  type AdminBrandingSlot,
  type BrandingSlotConfig,
  type PublicBranding,
} from "../../contracts/branding";
import {
  INITIAL_THEME_REVISION,
  ThemeRevisionConflictError,
  assertThemeRevision,
  nextThemeRevision,
} from "../../contracts/revisions";
import type { BrandingRow } from "../../schema/shared";
import { recordAudit } from "../audit/ThemeAuditSink";
import { themeAuditEvent } from "../audit/ThemeAuditEvents";
import type {
  ThemeAuditAction,
  ThemeAuditEvent,
  ThemeAuditMetadata,
} from "../audit/ThemeAuditEvents";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG } from "../tokens";
import { BrandingAssetService } from "./BrandingAssetService";
import { BrandingRepository } from "./BrandingRepository";
import { BrandingValidator, type BrandingSlotPatch } from "./BrandingValidator";

interface CommitOutcome {
  row: BrandingRow;
  config: BrandingSlotConfig;
  event: ThemeAuditEvent;
  /** Files the commit superseded. Deleted after it, never inside it. */
  replacedFileNames: string[];
}

@Service()
export class BrandingService {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private repository: BrandingRepository,
    private validator: BrandingValidator,
    private assets: BrandingAssetService,
    private transactions: TransactionService,
  ) {}

  // --------------------------------------------------------------------------
  // Reads
  // --------------------------------------------------------------------------

  /**
   * Resolved paths and a revision. Nothing else.
   *
   * No slot metadata, no upload timestamps, no indication of which slots are
   * customized — this is what the login page fetches before anybody has signed
   * in, and "which parts of our branding are bespoke" is not a fact an
   * anonymous visitor needs.
   */
  async getPublic(scopeId: string): Promise<PublicBranding> {
    const { row, resolved } = await this.resolve(scopeId);

    const slots: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(resolved)) slots[key] = value.path;

    return { slots, revision: row?.revision ?? INITIAL_THEME_REVISION };
  }

  async getAdmin(scopeId: string): Promise<AdminBranding> {
    const { row, resolved } = await this.resolve(scopeId);

    const slots: AdminBrandingSlot[] = this.validator.slots.map((definition) => {
      const value = resolved[definition.key];
      return {
        key: definition.key,
        kind: definition.kind,
        labelKey: definition.labelKey,
        maxBytes: definition.maxBytes,
        acceptedMimeTypes: [...definition.acceptedMimeTypes],
        previewAspect: definition.previewAspect ?? "natural",
        resolvedPath: value.path,
        isCustom: value.isCustom,
        inheritedFrom: value.inheritedFrom,
        uploadedAt: value.uploadedAt,
      };
    });

    return {
      slots,
      revision: row?.revision ?? INITIAL_THEME_REVISION,
      updatedAt: row?.updatedAt ?? null,
      updatedByActorId: row?.updatedByActorId ?? null,
    };
  }

  /** The committed file names, which is what makes an asset servable. */
  async referencedFileNames(scopeId: string): Promise<{
    fileNames: Set<string>;
    mimeTypes: Map<string, string>;
  }> {
    const row = await this.repository.read(scopeId);
    const config = this.validator.readStored(row?.slotConfig, scopeId);

    const fileNames = new Set<string>();
    const mimeTypes = new Map<string, string>();
    for (const asset of Object.values(config)) {
      fileNames.add(asset.fileName);
      mimeTypes.set(asset.fileName, asset.mimeType);
    }

    return { fileNames, mimeTypes };
  }

  private async resolve(scopeId: string) {
    const row = await this.repository.read(scopeId);
    const config = this.validator.readStored(row?.slotConfig, scopeId);
    return { row, config, resolved: this.resolveFrom(config) };
  }

  private resolveFrom(config: BrandingSlotConfig) {
    return resolveBrandingSlots({
      slots: this.validator.slots,
      config,
      // Called per read, so an application returning a fresh object keeps reads
      // independent. Its failure propagates, exactly as the factory design's
      // does — a branding factory that throws is a broken build.
      factory: this.config.factoryBranding(),
      assetPath: (fileName) => this.assets.publicPathFor(fileName),
    });
  }

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  /**
   * Commits a slot patch.
   *
   * The order is the whole design: the database write commits first, and only
   * then are superseded files deleted. Reversing it would leave a committed row
   * pointing at a file that no longer exists — a broken logo on every page that
   * nobody can fix from the settings screen, because the row looks fine.
   */
  async save(command: {
    scopeId: string;
    actorId: string | null;
    expectedRevision: number;
    slots: unknown;
    /** Candidate uploads the client is abandoning in the same action. */
    discardFileNames?: readonly string[];
  }): Promise<PublicBranding> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");
    const patch = this.validator.parsePatch(command.slots);

    const outcome = await this.transactions.run(
      async (transaction) => {
        const current = await this.repository.readForUpdate(command.scopeId);
        const currentConfig = this.validator.readStored(current?.slotConfig, command.scopeId);

        const { next, changedSlots, clearedSlots, replacedFileNames } = await this.applyPatch(
          command.scopeId,
          currentConfig,
          patch,
        );

        return this.commit(current, command.scopeId, command.expectedRevision, next, {
          actorId: command.actorId,
          transaction,
          action: "theme.branding.saved",
          metadata: { kind: "branding-save", changedSlots, clearedSlots },
          replacedFileNames,
        });
      },
      { database: this.config.database, retries: 1 },
    );

    await this.afterCommit(command.scopeId, outcome, command.discardFileNames ?? []);
    return this.publicFrom(outcome);
  }

  /** Clears every managed slot back to its factory or inherited value. */
  async reset(command: {
    scopeId: string;
    actorId: string | null;
    expectedRevision: number;
  }): Promise<PublicBranding> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");

    const outcome = await this.transactions.run(
      async (transaction) => {
        const current = await this.repository.readForUpdate(command.scopeId);
        const currentConfig = this.validator.readStored(current?.slotConfig, command.scopeId);

        return this.commit(current, command.scopeId, command.expectedRevision, {}, {
          actorId: command.actorId,
          transaction,
          action: "theme.branding.reset",
          metadata: { kind: "branding-reset", clearedSlots: Object.keys(currentConfig) },
          replacedFileNames: Object.values(currentConfig).map((asset) => asset.fileName),
        });
      },
      { database: this.config.database, retries: 1 },
    );

    await this.afterCommit(command.scopeId, outcome, []);
    return this.publicFrom(outcome);
  }

  /**
   * Deletes unreferenced assets older than the grace period.
   *
   * The reference set is read *inside* the same call that lists storage, so a
   * save landing between the two cannot make a just-committed file look like an
   * orphan.
   */
  async reconcileAssets(command: {
    scopeId: string;
    actorId: string | null;
  }): Promise<{ deleted: number; skipped: number }> {
    const { fileNames } = await this.referencedFileNames(command.scopeId);
    const result = await this.assets.reconcile({
      scopeId: command.scopeId,
      referencedFileNames: fileNames,
    });

    await recordAudit(
      this.config.audit,
      themeAuditEvent("theme.branding.assets.reconciled", {
        scopeId: command.scopeId,
        actorId: command.actorId,
        fromRevision: INITIAL_THEME_REVISION,
        toRevision: INITIAL_THEME_REVISION,
        metadata: { kind: "branding-reconcile", deletedCount: result.deleted },
      }),
      { diagnostics: this.config.diagnostics },
    );

    return result;
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async applyPatch(
    scopeId: string,
    current: BrandingSlotConfig,
    patch: BrandingSlotPatch,
  ): Promise<{
    next: BrandingSlotConfig;
    changedSlots: string[];
    clearedSlots: string[];
    replacedFileNames: string[];
  }> {
    const next: BrandingSlotConfig = { ...current };
    const changedSlots: string[] = [];
    const clearedSlots: string[] = [];
    const replacedFileNames: string[] = [];

    for (const [key, value] of Object.entries(patch)) {
      const existing = current[key];

      if (value === null) {
        if (!existing) continue;
        delete next[key];
        clearedSlots.push(key);
        replacedFileNames.push(existing.fileName);
        continue;
      }

      if (existing?.fileName === value.fileName) continue;

      // Re-derived from the stored bytes, not trusted from the request.
      next[key] = await this.assets.describeCandidate({
        scopeId,
        slot: this.validator.requireSlot(key),
        fileName: value.fileName,
      });
      changedSlots.push(key);
      if (existing) replacedFileNames.push(existing.fileName);
    }

    return { next, changedSlots, clearedSlots, replacedFileNames };
  }

  private async commit(
    current: BrandingRow | undefined,
    scopeId: string,
    expectedRevision: number,
    config: BrandingSlotConfig,
    options: {
      actorId: string | null;
      transaction: unknown;
      action: ThemeAuditAction;
      metadata: ThemeAuditMetadata;
      replacedFileNames: string[];
    },
  ): Promise<CommitOutcome> {
    const fromRevision = current?.revision ?? INITIAL_THEME_REVISION;
    let committed: BrandingRow;

    if (!current) {
      if (expectedRevision !== INITIAL_THEME_REVISION) {
        throw new ThemeRevisionConflictError("branding", expectedRevision, INITIAL_THEME_REVISION);
      }
      committed = await this.repository.insertCommitted({
        scopeId,
        slotConfig: config,
        revision: nextThemeRevision(INITIAL_THEME_REVISION),
        updatedByActorId: options.actorId,
      });
    } else {
      if (current.revision !== expectedRevision) {
        throw new ThemeRevisionConflictError("branding", expectedRevision, current.revision);
      }

      const updated = await this.repository.updateIfRevision(scopeId, expectedRevision, {
        slotConfig: config,
        revision: nextThemeRevision(current.revision),
        updatedByActorId: options.actorId,
      });
      if (!updated) {
        const latest = await this.repository.read(scopeId);
        throw new ThemeRevisionConflictError(
          "branding",
          expectedRevision,
          latest?.revision ?? expectedRevision + 1,
        );
      }
      committed = updated;
    }

    const event = themeAuditEvent(options.action, {
      scopeId,
      actorId: options.actorId,
      fromRevision,
      toRevision: committed.revision,
      metadata: options.metadata,
    });

    if (this.config.audit?.transactional) {
      await recordAudit(this.config.audit, event, {
        transaction: options.transaction,
        diagnostics: this.config.diagnostics,
      });
    }

    return { row: committed, config, event, replacedFileNames: options.replacedFileNames };
  }

  /**
   * Everything that must not happen inside the transaction: the external audit
   * call, and the file deletes.
   */
  private async afterCommit(
    scopeId: string,
    outcome: CommitOutcome,
    discardFileNames: readonly string[],
  ): Promise<void> {
    if (this.config.audit && !this.config.audit.transactional) {
      await recordAudit(this.config.audit, outcome.event, {
        diagnostics: this.config.diagnostics,
      });
    }

    await this.assets.cleanupReplaced(scopeId, outcome.replacedFileNames);

    // Filtered against what actually committed: a client can list a candidate
    // it thinks it abandoned while another administrator was saving that very
    // file, and deleting it would break their page.
    const committedFileNames = new Set(
      Object.values(outcome.config).map((asset) => asset.fileName),
    );
    await this.assets.cleanupCandidates(
      scopeId,
      discardFileNames.filter((fileName) => !committedFileNames.has(fileName)),
    );
  }

  private publicFrom(outcome: CommitOutcome): PublicBranding {
    const resolved = this.resolveFrom(outcome.config);
    const slots: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(resolved)) slots[key] = value.path;
    return { slots, revision: outcome.row.revision };
  }
}
