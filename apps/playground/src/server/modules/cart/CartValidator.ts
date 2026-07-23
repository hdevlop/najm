import { Service } from 'najm-api';
import { Err } from 'najm-api';
import { I18n, type TFn } from 'najm-i18n';
import { ProductRepository } from '../product/ProductRepository';
import type { Product } from '../product/ProductSchema';
import { CartRepository } from './CartRepository';
import type { CartItem } from './CartSchema';

@Service()
export class CartValidator {
  @I18n('cart') private t!: TFn;

  constructor(
    private cartRepository: CartRepository,
    private productRepository: ProductRepository,
  ) {}

  async ensureProductExists(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      Err(404, this.t('productNotFound'));
    }
    return product;
  }

  async ensureCartItemExists(userId: string, productId: string): Promise<CartItem> {
    const item = await this.cartRepository.findByUserAndProduct(userId, productId);
    if (!item) {
      Err(404, this.t('itemNotFound'));
    }
    return item;
  }

  ensureProductAvailable(product: Product): void {
    if (!product.isActive) {
      Err(400, this.t('productUnavailable'));
    }
  }

  ensureUpdatedItem(item: CartItem | undefined): CartItem {
    if (!item) {
      Err(404, this.t('itemNotFound'));
    }

    return item;
  }

  ensureRemoveSucceeded(removed: boolean): void {
    if (!removed) {
      Err(404, this.t('itemNotFound'));
    }
  }
}
