import { Repository } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { and, eq, ne } from 'drizzle-orm';
import { themeStylesTable, type NewThemeStyleRecord } from './ThemeStyleSchema';

@Repository()
export class ThemeStyleRepository {
  @DB() private db!: TDb;

  findByProject(projectId: string) {
    return this.db
      .select()
      .from(themeStylesTable)
      .where(eq(themeStylesTable.projectId, projectId))
      .orderBy(themeStylesTable.updatedAt);
  }

  async findById(id: string) {
    const [style] = await this.db.select().from(themeStylesTable).where(eq(themeStylesTable.id, id));
    return style;
  }

  async create(data: NewThemeStyleRecord) {
    const [style] = await this.db.insert(themeStylesTable).values(data).returning();
    return style;
  }

  async update(id: string, data: Partial<NewThemeStyleRecord>) {
    const [style] = await this.db
      .update(themeStylesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(themeStylesTable.id, id))
      .returning();
    return style;
  }

  async clearDefault(projectId: string, exceptId?: string) {
    await this.db
      .update(themeStylesTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        exceptId
          ? and(eq(themeStylesTable.projectId, projectId), ne(themeStylesTable.id, exceptId))
          : eq(themeStylesTable.projectId, projectId),
      );
  }

  async delete(id: string) {
    const result = await this.db.delete(themeStylesTable).where(eq(themeStylesTable.id, id));
    return result.changes > 0;
  }

  async deleteByProject(projectId: string) {
    await this.db.delete(themeStylesTable).where(eq(themeStylesTable.projectId, projectId));
  }
}