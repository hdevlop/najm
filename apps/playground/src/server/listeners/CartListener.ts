import { Service } from 'najm-api';
import { Log } from 'najm-api';
import { On } from 'najm-event';

@Service()
export class CartListener {
  @Log() private log!: any;

  @On('cart.item.added')
  async onCartItemAdded(data: { item: { id: string; userId: string; productId: string; quantity: number } }) {
    this.log.info('Cart item added event received', {
      cartItemId: data.item.id,
      userId: data.item.userId,
      productId: data.item.productId,
      quantity: data.item.quantity,
    });
  }

  @On('cart.item.updated')
  async onCartItemUpdated(data: { item: { id: string; userId: string; productId: string; quantity: number } }) {
    this.log.info('Cart item updated event received', {
      cartItemId: data.item.id,
      userId: data.item.userId,
      productId: data.item.productId,
      quantity: data.item.quantity,
    });
  }

  @On('cart.item.removed')
  async onCartItemRemoved(data: { userId: string; productId: string }) {
    this.log.info('Cart item removed event received', {
      userId: data.userId,
      productId: data.productId,
    });
  }

  @On('cart.cleared')
  async onCartCleared(data: { userId: string; removedCount: number }) {
    this.log.info('Cart cleared event received', {
      userId: data.userId,
      removedCount: data.removedCount,
    });
  }
}
