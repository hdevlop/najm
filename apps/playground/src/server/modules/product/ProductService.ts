import { Service } from 'najm-api';
import { type EventEmitter, Events } from 'najm-event';
import { type Resolved } from 'najm-api';
import { ProductRepository } from './ProductRepository';
import { ProductValidator } from './ProductValidator';
import type { Product } from './ProductSchema';
import type { UpdateProductDto } from './ProductDto';

type CreateProductInput = {
  userId: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  stock?: number;
  imageUrl?: string;
};

@Service()
export class ProductService {
  @Events() private events!: EventEmitter;

  constructor(
    private productRepository: ProductRepository,
    private productValidator: ProductValidator,
  ) {}

  async getAll(): Promise<Product[]> {
    return this.productRepository.findAll();
  }

  async getById(id: string): Promise<Product> {
    return this.productValidator.ensureProductExists(id);
  }

  async getByUserId(userId: string): Promise<Product[]> {
    return this.productRepository.findByUserId(userId);
  }

  async create(data: CreateProductInput): Promise<Product> {
    const product = await this.productRepository.create(data);
    this.events.emit('product.created', { product });
    return product;
  }

  async resolve(query: string): Promise<Resolved<Product>> {
    return this.productValidator.resolve(query);
  }

  async get(query: string): Promise<Resolved<Product> | Product> {
    const resolved = await this.productValidator.resolve(query);
    if (resolved.kind !== 'found') return resolved;
    return resolved.entity;
  }

  async updateById(id: string, data: UpdateProductDto, userId?: string): Promise<Product> {
    const existing = await this.productValidator.ensureProductExists(id);
    if (userId) {
      this.productValidator.ensureUserOwnsProduct(existing, userId);
    }

    const updated = await this.productRepository.update(id, data);
    const product = this.productValidator.ensureUpdatedProduct(updated);

    this.events.emit('product.updated', { product });
    return product;
  }

  async update(query: string, data: UpdateProductDto): Promise<Product> {
    const product = await this.productValidator.requireProduct(query);
    return this.updateById(product.id, data);
  }

  async deleteById(id: string, userId?: string): Promise<void> {
    const existing = await this.productValidator.ensureProductExists(id);
    if (userId) {
      this.productValidator.ensureUserOwnsProduct(existing, userId);
    }

    const success = await this.productRepository.delete(id);
    this.productValidator.ensureDeleteSucceeded(success);

    this.events.emit('product.deleted', { productId: id });
  }

  async delete(query: string): Promise<void> {
    const product = await this.productValidator.requireProduct(query);
    return this.deleteById(product.id);
  }
}
