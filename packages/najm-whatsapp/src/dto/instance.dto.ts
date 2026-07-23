import { z } from 'zod';

const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const CreateInstanceDto = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(INSTANCE_ID_PATTERN, 'Instance id must match [A-Za-z0-9_-]{1,64}')
    .optional(),
  name: z.string().min(1).max(120),
});

export type CreateInstanceDto = z.infer<typeof CreateInstanceDto>;
