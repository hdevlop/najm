// ============================================================================
// najm-theme/server — branding persistence
// ============================================================================
//
// The same compare-and-swap shape as `AppearanceRepository`, against the other
// table. Kept as its own class rather than a generic one parameterized by table
// because the two rows differ in what they hold and how they are read, and a
// shared base that took a table and a column name would be harder to follow
// than the fifty duplicated lines it saved.
// ============================================================================

import { and, eq } from "drizzle-orm";
import { Inject, Repository } from "najm-core";
import type { TDb } from "najm-database";

import type { BrandingSlotConfig } from "../../contracts/branding";
import type { BrandingRow } from "../../schema/shared";
import { nowIso } from "../../schema/shared";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG, THEME_SCHEMA } from "../tokens";

@Repository()
export class BrandingRepository {
  db!: TDb;

  @Inject(THEME_SCHEMA) private schema!: Record<string, any>;
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  private get table() {
    return this.schema.najmThemeBranding;
  }

  async read(scopeId: string): Promise<BrandingRow | undefined> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))
      .limit(1);
    return row as BrandingRow | undefined;
  }

  async readForUpdate(scopeId: string): Promise<BrandingRow | undefined> {
    const query = this.db
      .select()
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))
      .limit(1);

    const [row] = this.config.dialect === "pg" ? await query.for("update") : await query;
    return row as BrandingRow | undefined;
  }

  /** See `AppearanceRepository.insertCommitted` for why the revision is passed in. */
  async insertCommitted(row: {
    scopeId: string;
    slotConfig: BrandingSlotConfig;
    revision: number;
    updatedByActorId: string | null;
  }): Promise<BrandingRow> {
    const timestamp = nowIso();
    const [inserted] = await this.db
      .insert(this.table)
      .values({ ...row, createdAt: timestamp, updatedAt: timestamp })
      .returning();
    return inserted as BrandingRow;
  }

  async updateIfRevision(
    scopeId: string,
    expectedRevision: number,
    next: {
      slotConfig: BrandingSlotConfig;
      revision: number;
      updatedByActorId: string | null;
    },
  ): Promise<BrandingRow | undefined> {
    const [updated] = await this.db
      .update(this.table)
      .set({
        slotConfig: next.slotConfig,
        revision: next.revision,
        updatedByActorId: next.updatedByActorId,
        updatedAt: nowIso(),
      })
      .where(and(eq(this.table.scopeId, scopeId), eq(this.table.revision, expectedRevision)))
      .returning();

    return updated as BrandingRow | undefined;
  }
}
