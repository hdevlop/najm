// ============================================================================
// najm-theme/server — theme preset domain service
// ============================================================================

import { Inject, Service } from "najm-core";
import { TransactionService } from "najm-database";
import type { NajmDesignConfig } from "najm-kit/server";

import type { PublicAppearance } from "../../contracts/appearance";
import { describeThrown, reportDiagnostic } from "../../contracts/diagnostics";
import type { PublicThemePreset } from "../../contracts/presets";
import type { ThemePresetRow } from "../../schema/shared";
import { AppearanceService } from "../appearance/AppearanceService";
import { AppearanceValidator } from "../appearance/AppearanceValidator";
import { recordAudit } from "../audit/ThemeAuditSink";
import { themeAuditEvent } from "../audit/ThemeAuditEvents";
import type { ThemeAuditEvent } from "../audit/ThemeAuditEvents";
import type { ResolvedThemeConfig } from "../config";
import { ThemeNotFoundError, ThemePolicyError } from "../shared/errors";
import { THEME_CONFIG } from "../tokens";
import { ThemePresetRepository } from "./ThemePresetRepository";
import { ThemePresetValidator } from "./ThemePresetValidator";

@Service()
export class ThemePresetService {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private repository: ThemePresetRepository,
    private validator: ThemePresetValidator,
    private appearanceValidator: AppearanceValidator,
    private appearance: AppearanceService,
    private transactions: TransactionService,
  ) {}

  /**
   * Lists a scope's presets, omitting any whose stored design no longer
   * validates.
   *
   * Omitting rather than failing: one preset written before a validation rule
   * existed must not make the whole library unopenable, and the alternative —
   * returning it anyway — hands the client a design that would be rejected the
   * moment it tried to apply it. Each omission is reported once.
   */
  async list(scopeId: string): Promise<PublicThemePreset[]> {
    const rows = await this.repository.listByScope(scopeId);
    const presets: PublicThemePreset[] = [];

    for (const row of rows) {
      const design = this.appearanceValidator.parseStored(row.designConfig, {
        scopeId,
        code: "preset.invalid-design",
        detail: `preset ${row.slug} failed validation and was omitted from the list`,
      });
      if (design) presets.push(this.project(row, design));
    }

    return presets;
  }

  async create(command: {
    scopeId: string;
    actorId: string | null;
    name: unknown;
    designConfig: unknown;
    isBuiltIn?: boolean;
  }): Promise<PublicThemePreset> {
    const name = this.validator.name(command.name);
    const design = this.appearanceValidator.parseInbound(command.designConfig);

    const { preset, event } = await this.transactions.run(
      async () => {
        const index = await this.repository.scopeIndex(command.scopeId);
        this.validator.assertUnderLimit(index.count);

        const slug = this.validator.slugFor(name, index.slugs);
        const row = await this.repository.insert({
          scopeId: command.scopeId,
          slug,
          name,
          designConfig: design,
          isBuiltIn: command.isBuiltIn ?? false,
          createdByActorId: command.actorId,
        });

        const created = this.project(row, design);
        const auditEvent = themeAuditEvent("theme.preset.created", {
          scopeId: command.scopeId,
          actorId: command.actorId,
          // Presets carry no revision of their own; the appearance revision is
          // unchanged by creating one, and saying so is more honest than
          // inventing a counter that means nothing.
          fromRevision: 1,
          toRevision: 1,
          metadata: { kind: "preset-created", presetId: created.id, presetSlug: created.slug },
        });

        if (this.config.audit?.transactional) {
          await recordAudit(this.config.audit, auditEvent, {
            diagnostics: this.config.diagnostics,
          });
        }

        return { preset: created, event: auditEvent };
      },
      // One retry, because the derived slug is checked against a read and
      // decided by a unique index: two concurrent creates of the same name can
      // both derive `winter`, and the loser should get `winter-2` rather than a
      // constraint error.
      { database: this.config.database, retries: 1 },
    );

    await this.reportAudit(event);
    return preset;
  }

  /**
   * Applies a preset to appearance in one transaction.
   *
   * Reading the preset and writing appearance separately would leave a window
   * where the preset is deleted between the two, or where another save lands
   * between them and the revision check passes against state that no longer
   * exists. One transaction, one appearance lock, one outcome.
   */
  async apply(command: {
    scopeId: string;
    actorId: string | null;
    presetId: string;
    expectedRevision: number;
  }): Promise<PublicAppearance> {
    const { appearance, event } = await this.transactions.run(
      async (transaction) => {
        const row = await this.repository.findInScope(command.scopeId, command.presetId);
        if (!row) {
          throw new ThemeNotFoundError(`theme preset ${command.presetId} was not found`);
        }

        const design = this.appearanceValidator.parseStored(row.designConfig, {
          scopeId: command.scopeId,
          code: "preset.invalid-design",
          detail: `preset ${row.slug} failed validation and cannot be applied`,
        });
        if (!design) {
          throw new TypeError(
            `theme preset ${row.slug} holds a design that is no longer valid and cannot be applied`,
          );
        }

        const outcome = await this.appearance.commitReplacementInTransaction(
          {
            scopeId: command.scopeId,
            actorId: command.actorId,
            expectedRevision: command.expectedRevision,
            designConfig: design,
            audit: { kind: "appearance-preset", presetId: row.id, presetSlug: row.slug },
          },
          transaction,
        );

        return { appearance: outcome.appearance, event: outcome.event };
      },
      { database: this.config.database, retries: 1 },
    );

    await this.reportAudit(event);
    return appearance;
  }

  async delete(command: {
    scopeId: string;
    actorId: string | null;
    presetId: string;
  }): Promise<{ id: string; slug: string }> {
    const { deleted, event } = await this.transactions.run(
      async () => {
        const row = await this.repository.findInScope(command.scopeId, command.presetId);
        if (!row) {
          throw new ThemeNotFoundError(`theme preset ${command.presetId} was not found`);
        }

        // The policy the UI reads from the server projection. Deciding it in
        // both places is how a hidden delete button ends up in front of a
        // backend that would have allowed it — or the reverse.
        if (row.isBuiltIn && !this.validator.allowsBuiltInDeletion) {
          throw new ThemePolicyError(`theme preset ${row.slug} is built in and cannot be deleted`);
        }

        await this.repository.deleteInScope(command.scopeId, command.presetId);

        const auditEvent = themeAuditEvent("theme.preset.deleted", {
          scopeId: command.scopeId,
          actorId: command.actorId,
          fromRevision: 1,
          toRevision: 1,
          metadata: {
            kind: "preset-deleted",
            presetId: row.id,
            presetSlug: row.slug,
            wasBuiltIn: row.isBuiltIn,
          },
        });

        if (this.config.audit?.transactional) {
          await recordAudit(this.config.audit, auditEvent, {
            diagnostics: this.config.diagnostics,
          });
        }

        return { deleted: { id: row.id, slug: row.slug }, event: auditEvent };
      },
      { database: this.config.database, retries: 1 },
    );

    await this.reportAudit(event);
    return deleted;
  }

  private async reportAudit(event: ThemeAuditEvent): Promise<void> {
    if (!this.config.audit || this.config.audit.transactional) return;
    await recordAudit(this.config.audit, event, { diagnostics: this.config.diagnostics });
  }

  private project(row: ThemePresetRow, designConfig: NajmDesignConfig): PublicThemePreset {
    return {
      id: row.id,
      scopeId: row.scopeId,
      slug: row.slug,
      name: row.name,
      designConfig,
      isBuiltIn: row.isBuiltIn,
      createdAt: row.createdAt,
    };
  }
}
