import { Service } from 'najm-api';
import { On } from 'najm-event';
import { Log } from 'najm-api';

@Service()
export class ProductListener {
  @Log() private log!: any;

  @On('product.created')
  async onProductCreated(data: { product }) {
    this.log.info('Product created event received', {
      productId: data.product.id,
      name: data.product.name,
    });
  }

  @On('product.updated')
  async onProductUpdated(data: { product }) {
    this.log.info('Product updated event received', {
      productId: data.product.id,
    });
  }

  @On('product.deleted')
  async onProductDeleted(data: { productId: string }) {
    this.log.info('Product deleted event received', {
      productId: data.productId,
    });
  }
}
