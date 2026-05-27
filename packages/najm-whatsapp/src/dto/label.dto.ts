import { z } from 'zod';

export const CreateLabelDto = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #RRGGBB hex string'),
});

export type CreateLabelDto = z.infer<typeof CreateLabelDto>;
