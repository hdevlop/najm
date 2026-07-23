import { Service } from 'najm-api';
import { Err } from 'najm-api';
import { resolveBy, type Resolved } from 'najm-api';
import { I18n, type TFn } from 'najm-i18n';
import type { Product } from './ProductSchema';
import { ProductRepository } from './ProductRepository';

@Service()
export class ProductValidator {
  @I18n('products') private t!: TFn;

  constructor(private productRepository: ProductRepository) {}

  async resolve(query: string): Promise<Resolved<Product>> {
    return resolveBy(query, {
      findById: (id) => this.productRepository.findById(id),
      findExact: (name) => this.productRepository.findByName(name),
      search: (q) => this.productRepository.search(q),
      label: (product) => `${product.name} (${product.category})`,
    });
  }

  async requireProduct(query: string): Promise<Product> {
    const resolved = await this.resolve(query);
    if (resolved.kind === 'found') return resolved.entity;
    if (resolved.kind === 'not_found') Err(404, this.t('notFound'));
    Err(409, this.t('ambiguous'));
  }

  async ensureResolved(query: string): Promise<Product> {
    return this.requireProduct(query);
  }

  async ensureProductExists(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      Err(404, this.t('notFound'));
    }
    return product;
  }

  ensureUserOwnsProduct(product: Product, userId: string): void {
    if (!product.userId || product.userId !== userId) {
      Err(403, this.t('accessDenied'));
    }
  }

  ensureUpdatedProduct(product: Product | undefined): Product {
    if (!product) {
      Err(404, this.t('notFound'));
    }

    return product;
  }

  ensureDeleteSucceeded(success: boolean): void {
    if (!success) {
      Err(404, this.t('notFound'));
    }
  }
}
