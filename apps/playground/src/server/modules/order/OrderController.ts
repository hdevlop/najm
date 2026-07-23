import { Controller } from 'najm-api';
import { Policy, CanList, CanRead, CanCreate, CanUpdate, own, where } from 'najm-auth';
import { Body, Params, User } from 'najm-api';
import { Get, Patch, Post, ResMsg } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import {
  createOrderDto,
  orderIdParam,
  updateOrderStatusDto,
  type CreateOrderDto,
  type UpdateOrderStatusDto,
} from './OrderDto';
import { OrderService } from './OrderService';
import { ordersTable } from './OrderSchema';

const Order = own(ordersTable)
  .for('user', where(ordersTable.userId));

@ToolGroup('orders')
@Policy(Order)
@Controller('/orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Get('/my')
  @CanList()
  @McpTool({ description: 'List orders for the authenticated user', readOnly: true })
  @ResMsg('orders.retrieved')
  async getMyOrders(@User('id') userId: string) {
    return this.orderService.getMyOrders(userId);
  }

  @Get('/:id')
  @CanRead()
  @McpTool({ description: 'Fetch one of your orders by id', readOnly: true })
  @Validate({ params: orderIdParam })
  @ResMsg('orders.retrieved')
  async getById(@Params('id') id: string, @User('id') userId: string) {
    return this.orderService.getById(id, userId);
  }

  @Post('/')
  @CanCreate()
  @McpTool({ description: 'Create an order from explicit items', idempotent: false, confirm: { level: 'warning', message: 'orders.confirm.create' } })
  @Validate(createOrderDto)
  @ResMsg({ message: 'orders.created', status: 201 })
  async create(@Body() body: CreateOrderDto, @User('id') userId: string) {
    return this.orderService.create(userId, body);
  }

  @Post('/checkout')
  @CanCreate()
  @McpTool({ description: 'Create an order from the authenticated user cart', idempotent: false, confirm: { level: 'danger', message: 'orders.confirm.checkout' } })
  @ResMsg({ message: 'orders.checkoutCompleted', status: 201 })
  async checkout(@User('id') userId: string) {
    return this.orderService.checkout(userId);
  }

  @Patch('/:id/status')
  @CanUpdate()
  @McpTool({ description: 'Update the status of one of your orders', confirm: { level: 'danger', message: 'orders.confirm.updateStatus' } })
  @Validate({ params: orderIdParam, body: updateOrderStatusDto })
  @ResMsg('orders.statusUpdated')
  async updateStatus(
    @Params('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @User('id') userId: string,
  ) {
    return this.orderService.updateStatus(id, body.status, userId);
  }
}
