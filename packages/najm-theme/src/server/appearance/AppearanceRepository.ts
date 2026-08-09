// ============================================================================
// najm-theme/server — appearance persistence
// ============================================================================
//
// One repository for both dialects. The tables are column-for-column identical
// and are injected through `THEME_SCHEMA`, so the only dialect-specific code
// here is the row lock — `FOR UPDATE` exists in PostgreSQL and does not exist
// in SQLite, where a write transaction serializes anyway.
//
// The correctness of the revision check does not rest on that lock. Every write
// is a compare-and-swap: the `WHERE` clause carries the expected revision, and
// a write that changed no rows means somebody else committed first. That holds
// at any isolation level and in both dialects, which is what makes the same
// concurrency test meaningful against each.
// ============================================================================

import { and, eq } from "drizzle-orm";
import { Inject, Repository } from "najm-core";
import type { TDb } from "najm-database";

import type { NajmDesignConfig } from "najm-kit/server";

import { INITIAL_THEME_REVISION } from "../../contracts/revisions";
import type { AppearanceRow } from "../../schema/shared";
import { nowIso } from "../../schema/shared";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG, THEME_SCHEMA } from "../tokens";

@Repository()
export class AppearanceRepository {
  /**
   * Injected by `najm-database` for every `@Repository()`, and — importantly —
   * defined as a getter that returns the *active transaction* when one is
   * running. A method called inside `TransactionService.run()` therefore writes
   * through the transaction without threading a handle through every call.
   */
  db!: TDb;

  @Inject(THEME_SCHEMA) private schema!: Record<string, any>;
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  private get table() {
    return this.schema.najmThemeAppearance;
  }

  async read(scopeId: string): Promise<AppearanceRow | undefined> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))
      .limit(1);
    return row as AppearanceRow | undefined;
  }

  /**
   * Reads the row and holds it for the rest of the transaction.
   *
   * On PostgreSQL this is `SELECT … FOR UPDATE`, which serializes concurrent
   * savers at the read rather than letting both proceed to a write one of them
   * will lose. On SQLite the statement is a plain select — the transaction's
   * write lock does the same job — and the compare-and-swap below is what
   * actually decides the outcome in both.
   */
  async readForUpdate(scopeId: string): Promise<AppearanceRow | undefined> {
    const query = this.db
      .select()
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))
      .limit(1);

    const [row] = this.config.dialect === "pg" ? await query.for("update") : await query;
    return row as AppearanceRow | undefined;
  }

  /**
   * Creates the row for a scope that has never been saved.
   *
   * The revision is passed in rather than defaulted, because a scope with no
   * row already *reads* as revision 1 — that is what `getPublic` returns — so
   * the first committed mutation has to land on 2 for "increments by exactly
   * one per mutation" to hold across the row's own creation. The column default
   * of 1 stays for rows a consumer's data migration inserts directly.
   *
   * A concurrent creator wins the primary key and this throws, which the
   * service turns into a conflict — the same answer the compare-and-swap gives,
   * arrived at by the database rather than by a check.
   */
  async insertCommitted(row: {
    scopeId: string;
    designConfig: NajmDesignConfig | null;
    revision: number;
    updatedByActorId: string | null;
  }): Promise<AppearanceRow> {
    const timestamp = nowIso();
    const [inserted] = await this.db
      .insert(this.table)
      .values({
        scopeId: row.scopeId,
        designConfig: row.designConfig,
        revision: row.revision,
        updatedByActorId: row.updatedByActorId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();
    return inserted as AppearanceRow;
  }

  /**
   * The compare-and-swap. Returns `undefined` when no row matched, which the
   * caller reads as "someone else committed between the read and the write".
   */
  async updateIfRevision(
    scopeId: string,
    expectedRevision: number,
    next: {
      designConfig: NajmDesignConfig | null;
      revision: number;
      updatedByActorId: string | null;
    },
  ): Promise<AppearanceRow | undefined> {
    const [updated] = await this.db
      .update(this.table)
      .set({
        designConfig: next.designConfig,
        revision: next.revision,
        updatedByActorId: next.updatedByActorId,
        updatedAt: nowIso(),
      })
      .where(
        and(eq(this.table.scopeId, scopeId), eq(this.table.revision, expectedRevision)),
      )
      .returning();

    return updated as AppearanceRow | undefined;
  }
}
