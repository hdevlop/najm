import { Repository } from 'najm-core';
import { DB, type TDb } from 'najm-database';
import { eq } from 'drizzle-orm';
import { themeProjectsTable, type NewThemeProjectRecord } from './ThemeProjectSchema';

@Repository()
export class ThemeProjectRepository {
  @DB() private db!: TDb;

  findAll() {
    return this.db.select().from(themeProjectsTable).orderBy(themeProjectsTable.updatedAt);
  }

  async findById(id: string) {
    const [project] = await this.db.select().from(themeProjectsTable).where(eq(themeProjectsTable.id, id));
    return project;
  }

  async findBySlug(slug: string) {
    const [project] = await this.db.select().from(themeProjectsTable).where(eq(themeProjectsTable.slug, slug));
    return project;
  }

  async create(data: NewThemeProjectRecord) {
    const [project] = await this.db.insert(themeProjectsTable).values(data).returning();
    return project;
  }

  async update(id: string, data: Partial<NewThemeProjectRecord>) {
    const [project] = await this.db
      .update(themeProjectsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(themeProjectsTable.id, id))
      .returning();
    return project;
  }

  async delete(id: string) {
    const result = await this.db.delete(themeProjectsTable).where(eq(themeProjectsTable.id, id));
    return result.changes > 0;
  }
}