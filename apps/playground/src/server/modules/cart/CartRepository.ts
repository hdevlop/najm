import { Repository } from 'najm-api';
import { and, eq } from 'drizzle-orm';
import { DB, type TDb } from 'najm-database';
import { cartItemsTable, type CartItem } from './CartSchema';

type CreateCartItemInput = {
  userId: string;
  productId: string;
  quantity?: number;
};

@Repository()
export class CartRepository {
  @DB() private db!: TDb;

  async findByUserId(userId: string): Promise<CartItem[]> {
    return this.db.select().from(cartItemsTable).where(eq(cartItemsTable.userId, userId));
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<CartItem | undefined> {
    const [item] = await this.db
      .select()
      .from(cartItemsTable)
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.productId, productId)));
    return item;
  }

  async create(data: CreateCartItemInput): Promise<CartItem> {
    const [item] = await this.db.insert(cartItemsTable).values(data).returning();
    return item;
  }

  async updateQuantity(id: string, quantity: number): Promise<CartItem | undefined> {
    const [item] = await this.db
      .update(cartItemsTable)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItemsTable.id, id))
      .returning();
    return item;
  }

  async removeByUserAndProduct(userId: string, productId: string): Promise<boolean> {
    const result = await this.db
      .delete(cartItemsTable)
      .where(and(eq(cartItemsTable.userId, userId), eq(cartItemsTable.productId, productId)));
    return result.changes > 0;
  }

  async clearByUser(userId: string): Promise<number> {
    const result = await this.db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));
    return result.changes;
  }
}
