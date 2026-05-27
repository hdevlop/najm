import { z } from 'zod';

export type FeeRoundingMode = 'nearest' | 'up' | 'down';

export interface CalculateFeeDto {
  amount: number;
  percentageRate?: number;
  flatFee?: number;
  minimumFee?: number;
  maximumFee?: number;
  currency?: string;
  quantity?: number;
  rounding?: FeeRoundingMode;
}

export const calculateFeeDto = z.object({
  amount: z.number().positive(),
  percentageRate: z.number().min(0).max(100).default(2.9),
  flatFee: z.number().min(0).default(0.3),
  minimumFee: z.number().min(0).optional(),
  maximumFee: z.number().positive().optional(),
  currency: z.string().trim().length(3).default('USD'),
  quantity: z.number().int().positive().default(1),
  rounding: z.enum(['nearest', 'up', 'down']).default('nearest'),
}).superRefine((value, ctx) => {
  if (
    value.minimumFee !== undefined &&
    value.maximumFee !== undefined &&
    value.maximumFee < value.minimumFee
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maximumFee must be greater than or equal to minimumFee',
      path: ['maximumFee'],
    });
  }
});
