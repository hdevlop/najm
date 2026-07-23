import { z } from 'zod';

export const themeStyleIdParam = z.object({
  id: z.string().uuid(),
});

export const themeProjectStylesParam = z.object({
  projectId: z.string().uuid(),
});

export const najmDesignConfigDto = z
  .object({
    theme: z.object({}).passthrough(),
  })
  .passthrough();

export const createThemeStyleDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: najmDesignConfigDto,
  isDefault: z.boolean().optional(),
});

export const updateThemeStyleDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: najmDesignConfigDto.optional(),
  isDefault: z.boolean().optional(),
});

export const duplicateThemeStyleDto = z.object({
  name: z.string().min(1).max(100).optional(),
});

export type CreateThemeStyleDto = z.input<typeof createThemeStyleDto>;
export type UpdateThemeStyleDto = z.input<typeof updateThemeStyleDto>;
export type DuplicateThemeStyleDto = z.input<typeof duplicateThemeStyleDto>;