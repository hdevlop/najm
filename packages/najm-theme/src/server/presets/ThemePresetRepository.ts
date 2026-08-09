// ============================================================================
// najm-theme/server — theme preset persistence
// ============================================================================

import { and, asc, eq } from "drizzle-orm";
import { Inject, Repository } from "najm-core";
import type { TDb } from "najm-database";

import type { NajmDesignConfig } from "najm-kit/server";

import type { ThemePresetRow } from "../../schema/shared";
import { nowIso } from "../../schema/shared";
import { THEME_SCHEMA } from "../tokens";

@Repository()
export class ThemePresetRepository {
  db!: TDb;

  @Inject(THEME_SCHEMA) private schema!: Record<string, any>;

  private get table() {
    return this.schema.najmThemePresets;
  }

  /**
   * Every scoped query filters on `scopeId`, including the ones that also have
   * a primary key. Looking a preset up by id alone would let a tenant apply
   * another tenant's design by guessing a UUID — the id is unique, but it is
   * not an authorization.
   */
  async listByScope(scopeId: string): Promise<ThemePresetRow[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))
      .orderBy(asc(this.table.createdAt))) as ThemePresetRow[];
  }

  async findInScope(scopeId: string, id: string): Promise<ThemePresetRow | undefined> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.scopeId, scopeId), eq(this.table.id, id)))
      .limit(1);
    return row as ThemePresetRow | undefined;
  }

  /**
   * Slugs and count in one read.
   *
   * Both are needed by the same transaction — the limit check and the
   * uniqueness derivation — and issuing two statements would leave a window
   * where the count is from before an insert the slugs already reflect.
   */
  async scopeIndex(scopeId: string): Promise<{ count: number; slugs: Set<string> }> {
    const rows = (await this.db
      .select({ slug: this.table.slug })
      .from(this.table)
      .where(eq(this.table.scopeId, scopeId))) as { slug: string }[];

    return { count: rows.length, slugs: new Set(rows.map((row) => row.slug)) };
  }

  async insert(row: {
    scopeId: string;
    slug: string;
    name: string;
    designConfig: NajmDesignConfig;
    isBuiltIn: boolean;
    createdByActorId: string | null;
  }): Promise<ThemePresetRow> {
    const timestamp = nowIso();
    const [inserted] = await this.db
      .insert(this.table)
      .values({ ...row, createdAt: timestamp, updatedAt: timestamp })
      .returning();
    return inserted as ThemePresetRow;
  }

  async deleteInScope(scopeId: string, id: string): Promise<ThemePresetRow | undefined> {
    const [deleted] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.scopeId, scopeId), eq(this.table.id, id)))
      .returning();
    return deleted as ThemePresetRow | undefined;
  }
}
