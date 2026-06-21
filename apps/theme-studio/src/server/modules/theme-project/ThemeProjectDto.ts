import { z } from 'zod';

export const themeProjectIdParam = z.object({
  id: z.string().uuid(),
});

export const createThemeProjectDto = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(500).optional(),
});

export const updateThemeProjectDto = createThemeProjectDto.partial();

export type CreateThemeProjectDto = z.input<typeof createThemeProjectDto>;
export type UpdateThemeProjectDto = z.input<typeof updateThemeProjectDto>;