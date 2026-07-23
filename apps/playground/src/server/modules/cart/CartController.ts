import { Controller } from 'najm-api';
import { Body, Params, User } from 'najm-api';
import { Delete, Get, Post, Put, ResMsg } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Policy, CanRead, CanCreate, CanUpdate, CanDelete, own, where } from 'najm-auth';
import { Validate } from 'najm-validation';
import {
  addCartItemDto,
  cartProductParam,
  updateCartItemDto,
  type AddCartItemDto,
  type UpdateCartItemDto,
} from './CartDto';
import { CartService } from './CartService';
import { cartItemsTable } from './CartSchema';

const Cart = own(cartItemsTable)
  .for('user', where(cartItemsTable.userId));

@ToolGroup('cart')
@Policy(Cart)
@Controller('/cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get('/')
  @CanRead()
  @McpTool({ description: 'Get the authenticated user cart', readOnly: true })
  @ResMsg('cart.retrieved')
  async getMyCart(@User('id') userId: string) {
    return this.cartService.getMyCart(userId);
  }

  @Post('/items')
  @CanCreate()
  @McpTool({ description: 'Add an item to the authenticated user cart', idempotent: false, confirm: { level: 'notice', message: 'cart.confirm.addItem' } })
  @Validate(addCartItemDto)
  @ResMsg({ message: 'cart.itemAdded', status: 201 })
  async add(@Body() body: AddCartItemDto, @User('id') userId: string) {
    return this.cartService.addItem(userId, body);
  }

  @Put('/items/:productId')
  @CanUpdate()
  @McpTool({ description: 'Update quantity for a cart item', confirm: { level: 'warning', message: 'cart.confirm.updateItem' } })
  @Validate({ params: cartProductParam, body: updateCartItemDto })
  @ResMsg('cart.itemUpdated')
  async update(
    @Params('productId') productId: string,
    @Body() body: UpdateCartItemDto,
    @User('id') userId: string,
  ) {
    return this.cartService.updateItem(userId, productId, body);
  }

  @Delete('/items/:productId')
  @CanDelete()
  @McpTool({ description: 'Remove one item from the cart', destructive: true, confirm: { level: 'danger', message: 'cart.confirm.removeItem' } })
  @Validate({ params: cartProductParam })
  @ResMsg('cart.itemRemoved')
  async remove(@Params('productId') productId: string, @User('id') userId: string) {
    await this.cartService.removeItem(userId, productId);
    return { removed: true };
  }

  @Delete('/clear')
  @CanDelete()
  @McpTool({ description: 'Clear the authenticated user cart', destructive: true, confirm: { level: 'danger', message: 'cart.confirm.clear' } })
  @ResMsg('cart.cleared')
  async clear(@User('id') userId: string) {
    const removedCount = await this.cartService.clear(userId);
    return { removedCount };
  }
}
