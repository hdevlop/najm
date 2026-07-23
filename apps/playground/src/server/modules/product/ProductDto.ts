import { z } from 'zod';

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;
  stock?: number;
  category: string;
  imageUrl?: string;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  category?: string;
  imageUrl?: string;
}

export const createProductDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
  stock: z.number().int().nonnegative().default(0),
  category: z.string().min(1).max(50),
  imageUrl: z.string().url().optional(),
});

export const updateProductDto = createProductDto.partial();

export const productIdParam = z.object({
  id: z.string().uuid('Invalid product ID'),
});

export const productParam = z.object({
  product: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.product || value.id || value.name) return;

  ctx.addIssue({
    code: 'custom',
    message: 'Provide product, id, or name.',
    path: ['product'],
  });
});

export type ProductParamDto = z.input<typeof productParam>;

export function resolveProductParam(body: ProductParamDto): string {
  return body.product ?? body.id ?? body.name ?? '';
}

const productMutationParam = z.object({
  product: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});

function requireProductSelector(value: { product?: string; id?: string }, ctx: z.RefinementCtx) {
  if (value.product || value.id) return;

  ctx.addIssue({
    code: 'custom',
    message: 'Provide product or id.',
    path: ['product'],
  });
}

const productMcpUpdateFields = {
  name: true,
  description: true,
  price: true,
  stock: true,
  category: true,
  imageUrl: true,
} as const;

export const productUpdateDto = productMutationParam
  .merge(updateProductDto.pick(productMcpUpdateFields))
  .superRefine(requireProductSelector);
export type ProductUpdateDto = z.input<typeof productUpdateDto>;
