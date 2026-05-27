import { z } from 'zod';

export const CreateInstanceDto = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
});

export type CreateInstanceDto = z.infer<typeof CreateInstanceDto>;
