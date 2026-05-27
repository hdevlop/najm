import { z } from 'zod';
import type { OrderStatus } from './OrderSchema';
import { ORDER_STATUSES } from './OrderSchema';

export interface CreateOrderItemDto {
  productId: string;
  quantity: number;
}

export interface CreateOrderDto {
  items: CreateOrderItemDto[];
}

export interface UpdateOrderStatusDto {
  status: OrderStatus;
}

export const orderItemDto = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive(),
});

export const createOrderDto = z.object({
  items: z.array(orderItemDto).min(1, 'Order must include at least one item'),
});

export const updateOrderStatusDto = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const orderIdParam = z.object({
  id: z.string().uuid('Invalid order ID'),
});
