import { Service } from 'najm-api';
import { type EventEmitter, Events } from 'najm-event';
import { ProductRepository } from '../product/ProductRepository';
import type { Product } from '../product/ProductSchema';
import type { AddCartItemDto, UpdateCartItemDto } from './CartDto';
import { CartRepository } from './CartRepository';
import { CartValidator } from './CartValidator';
import type { CartItem } from './CartSchema';

type CartSummaryItem = CartItem & {
  product: Product;
  lineTotal: number;
};

type CartSummary = {
  items: CartSummaryItem[];
  total: number;
  quantity: number;
};

@Service()
export class CartService {
  @Events() private events!: EventEmitter;

  constructor(
    private cartRepository: CartRepository,
    private productRepository: ProductRepository,
    private validator: CartValidator,
  ) {}

  async getMyCart(userId: string): Promise<CartSummary> {
    const cartItems = await this.cartRepository.findByUserId(userId);

    const items = (
      await Promise.all(
        cartItems.map(async (item) => {
          const product = await this.productRepository.findById(item.productId);
          if (!product) {
            return null;
          }
          return {
            ...item,
            product,
            lineTotal: Number(product.price) * item.quantity,
          };
        }),
      )
    ).filter((item): item is CartSummaryItem => item !== null);

    return {
      items,
      total: items.reduce((sum, item) => sum + item.lineTotal, 0),
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async addItem(userId: string, data: AddCartItemDto): Promise<CartItem> {
    const product = await this.validator.ensureProductExists(data.productId);
    this.validator.ensureProductAvailable(product);

    const existing = await this.cartRepository.findByUserAndProduct(userId, data.productId);
    if (existing) {
      const updated = await this.cartRepository.updateQuantity(existing.id, existing.quantity + data.quantity);
      const item = this.validator.ensureUpdatedItem(updated);
      this.events.emit('cart.item.updated', { item });
      return item;
    }

    const created = await this.cartRepository.create({
      userId,
      productId: data.productId,
      quantity: data.quantity,
    });

    this.events.emit('cart.item.added', { item: created });
    return created;
  }

  async updateItem(userId: string, productId: string, data: UpdateCartItemDto): Promise<CartItem> {
    const existing = await this.validator.ensureCartItemExists(userId, productId);
    const updated = await this.cartRepository.updateQuantity(existing.id, data.quantity);
    const item = this.validator.ensureUpdatedItem(updated);

    this.events.emit('cart.item.updated', { item });
    return item;
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.validator.ensureCartItemExists(userId, productId);
    const removed = await this.cartRepository.removeByUserAndProduct(userId, productId);
    this.validator.ensureRemoveSucceeded(removed);
    this.events.emit('cart.item.removed', { userId, productId });
  }

  async clear(userId: string): Promise<number> {
    const removedCount = await this.cartRepository.clearByUser(userId);
    this.events.emit('cart.cleared', { userId, removedCount });
    return removedCount;
  }
}
