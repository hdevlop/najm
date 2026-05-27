import { Service } from 'najm-api';
import { type EventEmitter, Events } from 'najm-event';
import { CartRepository } from '../cart/CartRepository';
import { ProductRepository } from '../product/ProductRepository';
import type { CreateOrderDto } from './OrderDto';
import { OrderRepository } from './OrderRepository';
import { OrderValidator } from './OrderValidator';
import { type OrderItem, type OrderStatus } from './OrderSchema';

type CreateOrderItemInput = {
  productId: string;
  quantity: number;
};

@Service()
export class OrderService {
  @Events() private events!: EventEmitter;

  constructor(
    private orderRepository: OrderRepository,
    private productRepository: ProductRepository,
    private cartRepository: CartRepository,
    private validator: OrderValidator,
  ) {}

  async getMyOrders(userId: string) {
    const orders = await this.orderRepository.findByUserId(userId);

    return Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await this.orderRepository.findItemsByOrderId(order.id),
      })),
    );
  }

  async getById(id: string, userId: string) {
    const order = await this.validator.ensureOrderExists(id);
    this.validator.ensureUserOwnsOrder(order, userId);

    const items = await this.orderRepository.findItemsByOrderId(order.id);
    return { ...order, items };
  }

  async create(userId: string, data: CreateOrderDto) {
    const resolvedItems = await this.resolveOrderItems(data.items);
    const total = this.calculateTotal(resolvedItems);

    const created = await this.orderRepository.create(
      {
        userId,
        total,
      },
      resolvedItems,
    );

    const order = {
      ...created.order,
      items: created.items,
    };

    this.events.emit('order.created', { order });
    return order;
  }

  async checkout(userId: string) {
    const cartItems = await this.cartRepository.findByUserId(userId);
    this.validator.ensureCartNotEmpty(cartItems);

    const order = await this.create(userId, {
      items: cartItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    });

    await this.cartRepository.clearByUser(userId);
    this.events.emit('order.checkout', { order });
    return order;
  }

  async updateStatus(id: string, status: OrderStatus, userId: string) {
    const order = await this.validator.ensureOrderExists(id);
    this.validator.ensureUserOwnsOrder(order, userId);
    this.validator.ensureStatusCanChange(order.status, status);

    const updated = await this.orderRepository.updateStatus(id, status);
    const nextOrder = this.validator.ensureUpdatedOrder(updated);

    this.events.emit('order.status.updated', { orderId: id, status });
    return nextOrder;
  }

  private async resolveOrderItems(items: CreateOrderItemInput[]) {
    const merged = this.mergeDuplicateItems(items);

    return Promise.all(
      merged.map(async (item) => {
        const rawProduct = await this.productRepository.findById(item.productId);
        const product = this.validator.ensureOrderProductExists(rawProduct);
        this.validator.ensureProductAvailable(product);

        return {
          productId: product.id,
          quantity: item.quantity,
          price: Number(product.price),
        };
      }),
    );
  }

  private mergeDuplicateItems(items: CreateOrderItemInput[]): CreateOrderItemInput[] {
    const bucket = new Map<string, number>();

    for (const item of items) {
      const currentQuantity = bucket.get(item.productId) ?? 0;
      bucket.set(item.productId, currentQuantity + item.quantity);
    }

    return Array.from(bucket.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  }

  private calculateTotal(items: Array<Pick<OrderItem, 'price' | 'quantity'>>): number {
    return items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  }
}
