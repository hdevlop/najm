import { Service } from 'najm-api';
import { CartRepository } from '../cart/CartRepository';
import { OrderRepository } from '../order/OrderRepository';
import { ProductRepository } from '../product/ProductRepository';

@Service()
export class SummaryService {
  constructor(
    private products: ProductRepository,
    private carts: CartRepository,
    private orders: OrderRepository,
  ) {}

  async summary() {
    const [products, orders] = await Promise.all([
      this.products.findAll(),
      this.orders.findByUserId('demo-user').catch(() => []),
    ]);

    const carts = await this.carts.findByUserId('demo-user').catch(() => []);

    return {
      app: 'najm-playground',
      now: new Date().toISOString(),
      totals: {
        products: products.length,
        demoUserOrders: orders.length,
        demoUserCartItems: carts.length,
      },
    };
  }
}
