import { Service } from 'najm-api';
import { Log } from 'najm-api';
import { On } from 'najm-event';

@Service()
export class OrderListener {
  @Log() private log!: any;

  @On('order.created')
  async onOrderCreated(data: { order: { id: string; userId: string; total: number; status: string } }) {
    this.log.info('Order created event received', {
      orderId: data.order.id,
      userId: data.order.userId,
      status: data.order.status,
      total: data.order.total,
    });
  }

  @On('order.checkout')
  async onOrderCheckout(data: { order: { id: string; userId: string; total: number; status: string } }) {
    this.log.info('Order checkout event received', {
      orderId: data.order.id,
      userId: data.order.userId,
      status: data.order.status,
      total: data.order.total,
    });
  }

  @On('order.status.updated')
  async onOrderStatusUpdated(data: { orderId: string; status: string }) {
    this.log.info('Order status updated event received', {
      orderId: data.orderId,
      status: data.status,
    });
  }
}
