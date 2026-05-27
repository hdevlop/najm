import { Repository } from 'najm-api';
import { eq } from 'drizzle-orm';
import { DB, type TDb } from 'najm-database';
import { orderItemsTable, ordersTable, type NewOrder, type Order, type OrderItem } from './OrderSchema';

type CreateOrderItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

@Repository()
export class OrderRepository {
  @DB() private db!: TDb;

  async findByUserId(userId: string): Promise<Order[]> {
    return this.db.select().from(ordersTable).where(eq(ordersTable.userId, userId));
  }

  async findById(id: string): Promise<Order | undefined> {
    const [order] = await this.db.select().from(ordersTable).where(eq(ordersTable.id, id));
    return order;
  }

  async findItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    return this.db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  }

  async create(data: NewOrder, items: CreateOrderItemInput[]): Promise<{ order: Order; items: OrderItem[] }> {
    const [order] = await this.db.insert(ordersTable).values(data).returning();
    const itemsWithOrderId = items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const createdItems = itemsWithOrderId.length
      ? await this.db.insert(orderItemsTable).values(itemsWithOrderId).returning()
      : [];

    return { order, items: createdItems };
  }

  async updateStatus(id: string, status: string): Promise<Order | undefined> {
    const [order] = await this.db
      .update(ordersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    return order;
  }
}
