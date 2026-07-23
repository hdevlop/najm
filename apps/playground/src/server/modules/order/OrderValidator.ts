import { Service } from 'najm-api';
import { Err } from 'najm-api';
import { I18n, type TFn } from 'najm-i18n';
import type { Product } from '../product/ProductSchema';
import { type Order, type OrderStatus } from './OrderSchema';
import { OrderRepository } from './OrderRepository';

@Service()
export class OrderValidator {
  @I18n('orders') private t!: TFn;

  constructor(private orderRepository: OrderRepository) {}

  async ensureOrderExists(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      Err(404, this.t('notFound'));
    }
    return order;
  }

  ensureUserOwnsOrder(order: Order, userId: string): void {
    if (!order.userId || order.userId !== userId) {
      Err(403, this.t('accessDenied'));
    }
  }

  ensureStatusCanChange(currentStatus: string, nextStatus: OrderStatus): void {
    if (currentStatus === nextStatus) {
      return;
    }

    if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
      Err(400, this.t('statusLocked'));
    }
  }

  ensureCartNotEmpty(items: { length: number }): void {
    if (!items.length) {
      Err(400, this.t('cartEmpty'));
    }
  }

  ensureUpdatedOrder(order: Order | undefined): Order {
    if (!order) {
      Err(404, this.t('notFound'));
    }

    return order;
  }

  ensureOrderProductExists(product: Product | undefined): Product {
    if (!product) {
      Err(404, this.t('productNotFound'));
    }

    return product;
  }

  ensureProductAvailable(product: Product): void {
    if (!product.isActive) {
      Err(400, this.t('productUnavailable'));
    }
  }
}
