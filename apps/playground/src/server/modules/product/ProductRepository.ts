import { Repository } from 'najm-api';
import { eq, like, or } from 'drizzle-orm';
import { DB, type TDb } from 'najm-database';
import { normalizeResolutionQuery, escapeLike } from 'najm-api';
import { productsTable, type NewProduct, type Product } from './ProductSchema';

@Repository()
export class ProductRepository {
  @DB() private db!: TDb;

  async findAll(): Promise<Product[]> {
    return this.db.select().from(productsTable);
  }

  async findById(id: string): Promise<Product | undefined> {
    const [product] = await this.db.select().from(productsTable).where(eq(productsTable.id, id));
    return product;
  }

  async findByName(name: string): Promise<Product | undefined> {
    const [product] = await this.db.select().from(productsTable).where(eq(productsTable.name, name));
    return product;
  }

  async findByUserId(userId: string): Promise<Product[]> {
    return this.db.select().from(productsTable).where(eq(productsTable.userId, userId));
  }

  async search(query: string, limit = 5): Promise<Product[]> {
    const trimmed = normalizeResolutionQuery(query);
    const safeLimit = Math.min(Math.max(limit, 1), 20);
    const pattern = `%${escapeLike(trimmed)}%`;
    return this.db
      .select()
      .from(productsTable)
      .where(
        or(
          like(productsTable.name, pattern),
          like(productsTable.category, pattern),
        ),
      )
      .orderBy(productsTable.name)
      .limit(safeLimit);
  }

  async create(data: NewProduct): Promise<Product> {
    const [product] = await this.db.insert(productsTable).values(data).returning();
    return product;
  }

  async update(id: string, data: Partial<NewProduct>): Promise<Product | undefined> {
    const [product] = await this.db
      .update(productsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productsTable.id, id))
      .returning();
    return product;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(productsTable).where(eq(productsTable.id, id));
    return result.changes > 0;
  }
}
