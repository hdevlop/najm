// ============================================================================
// najm-theme/server — appearance domain service
// ============================================================================

import { Inject, Service } from "najm-core";
import { TransactionService } from "najm-database";
import type { NajmDesignConfig } from "najm-kit/server";

import {
  changedAppearanceGroups,
  mergeAppearance,
  type AdminAppearance,
  type AppearanceGroup,
  type PublicAppearance,
} from "../../contracts/appearance";
import {
  INITIAL_THEME_REVISION,
  ThemeRevisionConflictError,
  assertThemeRevision,
  nextThemeRevision,
} from "../../contracts/revisions";
import type { AppearanceRow } from "../../schema/shared";
import { recordAudit } from "../audit/ThemeAuditSink";
import { themeAuditEvent } from "../audit/ThemeAuditEvents";
import type {
  ThemeAuditAction,
  ThemeAuditEvent,
  ThemeAuditMetadata,
} from "../audit/ThemeAuditEvents";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG } from "../tokens";
import { AppearanceRepository } from "./AppearanceRepository";
import { AppearanceValidator } from "./AppearanceValidator";

export interface SaveAppearanceCommand {
  scopeId: string;
  actorId: string | null;
  expectedRevision: number;
  /** Root groups to replace. Groups left out keep their stored value. */
  patch: Partial<Pick<NajmDesignConfig, AppearanceGroup>>;
}

export interface ReplaceAppearanceCommand {
  scopeId: string;
  actorId: string | null;
  expectedRevision: number;
  /** The complete design, as captured by a preset. */
  designConfig: NajmDesignConfig;
  audit: ThemeAuditMetadata;
}

interface CommitOutcome {
  appearance: PublicAppearance;
  event: ThemeAuditEvent;
}

@Service()
export class AppearanceService {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private repository: AppearanceRepository,
    private validator: AppearanceValidator,
    private transactions: TransactionService,
  ) {}

  // --------------------------------------------------------------------------
  // Reads
  // --------------------------------------------------------------------------

  /**
   * Always a complete, validated design plus a revision.
   *
   * Never partial and never an error. Every caller of this is rendering a page,
   * and a theme endpoint that can fail is a theme endpoint that takes the login
   * screen down with it. A row that does not parse falls back to the factory
   * design and reports a diagnostic — and the revision stays the stored one, so
   * a client editing against it still gets a clean conflict rather than
   * silently overwriting a row nobody could read.
   */
  async getPublic(scopeId: string): Promise<PublicAppearance> {
    const row = await this.repository.read(scopeId);
    return {
      designConfig: this.resolveDesign(row, scopeId),
      revision: row?.revision ?? INITIAL_THEME_REVISION,
    };
  }

  async getAdmin(scopeId: string): Promise<AdminAppearance> {
    const row = await this.repository.read(scopeId);
    const stored = row?.designConfig ?? null;

    return {
      designConfig: this.resolveDesign(row, scopeId),
      revision: row?.revision ?? INITIAL_THEME_REVISION,
      isFactory: stored === null,
      updatedAt: row?.updatedAt ?? null,
      updatedByActorId: row?.updatedByActorId ?? null,
    };
  }

  private resolveDesign(row: AppearanceRow | undefined, scopeId: string): NajmDesignConfig {
    const stored = this.validator.parseStored(row?.designConfig ?? null, {
      scopeId,
      code: "appearance.invalid-stored-config",
      detail: "stored design failed validation; serving the factory design",
    });
    return stored ?? this.validator.factory();
  }

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  /** Merges an edit over the stored design, group by group. */
  async save(command: SaveAppearanceCommand): Promise<PublicAppearance> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");

    return this.runMutation((transaction) =>
      this.withLockedRow(command.scopeId, async (current) => {
        const base = this.resolveDesign(current, command.scopeId);
        const merged = this.validator.parseInbound(mergeAppearance(base, command.patch));

        return this.commit(current, command.scopeId, command.expectedRevision, merged, {
          actorId: command.actorId,
          transaction,
          action: "theme.appearance.saved",
          metadata: {
            kind: "appearance-save",
            changedGroups: changedAppearanceGroups(base, merged),
          },
        });
      }),
    );
  }

  /**
   * Replaces the whole design — how applying a preset commits.
   *
   * Separate from `save` rather than a flag on it, because the two differ in
   * what they promise. A save keeps every group it was not given; an apply
   * guarantees that what is stored afterwards is exactly the preset, including
   * the groups the preset does not define.
   */
  async replace(command: ReplaceAppearanceCommand): Promise<PublicAppearance> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");
    const design = this.validator.parseInbound(command.designConfig);

    return this.runMutation((transaction) =>
      this.withLockedRow(command.scopeId, (current) =>
        this.commit(current, command.scopeId, command.expectedRevision, design, {
          actorId: command.actorId,
          transaction,
          action:
            command.audit.kind === "appearance-preset"
              ? "theme.appearance.preset-applied"
              : "theme.appearance.saved",
          metadata: command.audit,
        }),
      ),
    );
  }

  /**
   * Stores `null` — the factory state — and still increments the revision.
   *
   * Deliberately not a delete of the row. A client holding revision 6 must fail
   * cleanly after a reset rather than re-saving the design that was just
   * discarded, and that requires the reset to be a version everyone can be
   * behind.
   */
  async reset(command: {
    scopeId: string;
    actorId: string | null;
    expectedRevision: number;
  }): Promise<PublicAppearance> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");

    return this.runMutation((transaction) =>
      this.withLockedRow(command.scopeId, (current) =>
        this.commit(current, command.scopeId, command.expectedRevision, null, {
          actorId: command.actorId,
          transaction,
          action: "theme.appearance.reset",
          metadata: { kind: "appearance-reset" },
        }),
      ),
    );
  }

  /**
   * Exposed for the preset service, which applies a preset and updates
   * appearance in one transaction rather than two round trips that could
   * interleave with a save.
   */
  async commitReplacementInTransaction(
    command: ReplaceAppearanceCommand,
    transaction: unknown,
  ): Promise<CommitOutcome> {
    assertThemeRevision(command.expectedRevision, "expectedRevision");
    const design = this.validator.parseInbound(command.designConfig);

    return this.withLockedRow(command.scopeId, (current) =>
      this.commit(current, command.scopeId, command.expectedRevision, design, {
        actorId: command.actorId,
        transaction,
        action: "theme.appearance.preset-applied",
        metadata: command.audit,
      }),
    );
  }

  // --------------------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------------------

  private async withLockedRow<T>(
    scopeId: string,
    body: (current: AppearanceRow | undefined) => Promise<T>,
  ): Promise<T> {
    return body(await this.repository.readForUpdate(scopeId));
  }

  /**
   * Runs the mutation, then reports the audit event.
   *
   * A transactional sink already recorded inside `commit`, in the same
   * transaction as the state write. A non-transactional one is called here,
   * *after* the commit — an external audit service must never hold a database
   * transaction open, and its timeout must never roll back a save the
   * administrator has already been told succeeded.
   */
  private async runMutation(
    body: (transaction: unknown) => Promise<CommitOutcome>,
  ): Promise<PublicAppearance> {
    const outcome = await this.transactions.run((transaction) => body(transaction), {
      database: this.config.database,
      retries: 1,
    });

    if (this.config.audit && !this.config.audit.transactional) {
      await recordAudit(this.config.audit, outcome.event, {
        diagnostics: this.config.diagnostics,
      });
    }

    return outcome.appearance;
  }

  /**
   * The one place a revision moves.
   *
   * Called with the row already locked. `design === null` means the factory
   * state; anything else has been through the validator.
   */
  private async commit(
    current: AppearanceRow | undefined,
    scopeId: string,
    expectedRevision: number,
    design: NajmDesignConfig | null,
    options: {
      actorId: string | null;
      transaction: unknown;
      action: ThemeAuditAction;
      metadata: ThemeAuditMetadata;
    },
  ): Promise<CommitOutcome> {
    const fromRevision = current?.revision ?? INITIAL_THEME_REVISION;
    let committed: AppearanceRow;

    if (!current) {
      // No row yet, so the only revision a client can legitimately hold is the
      // initial one. Anything else means it is editing a scope that was reset
      // out from under it, or a scope it invented.
      if (expectedRevision !== INITIAL_THEME_REVISION) {
        throw new ThemeRevisionConflictError("appearance", expectedRevision, INITIAL_THEME_REVISION);
      }
      committed = await this.repository.insertCommitted({
        scopeId,
        designConfig: design,
        revision: nextThemeRevision(INITIAL_THEME_REVISION),
        updatedByActorId: options.actorId,
      });
    } else {
      if (current.revision !== expectedRevision) {
        throw new ThemeRevisionConflictError("appearance", expectedRevision, current.revision);
      }

      const updated = await this.repository.updateIfRevision(scopeId, expectedRevision, {
        designConfig: design,
        revision: nextThemeRevision(current.revision),
        updatedByActorId: options.actorId,
      });

      // The check above passed and this still matched nothing: another writer
      // committed between the read and the write. Reachable on SQLite, where
      // the read does not take a write lock.
      if (!updated) {
        const latest = await this.repository.read(scopeId);
        throw new ThemeRevisionConflictError(
          "appearance",
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

    return {
      appearance: {
        designConfig: design ?? this.validator.factory(),
        revision: committed.revision,
      },
      event,
    };
  }
}
