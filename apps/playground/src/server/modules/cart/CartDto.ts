import { z } from 'zod';

export interface AddCartItemDto {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export const addCartItemDto = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive().default(1),
});

export const updateCartItemDto = z.object({
  quantity: z.number().int().positive(),
});

export const cartProductParam = z.object({
  productId: z.string().uuid('Invalid product ID'),
});
