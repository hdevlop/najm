// ============================================================================
// najm-storage - DTOs & Zod Schemas
// ============================================================================

import { z } from 'zod';

export const namespaceParam = z.object({
  namespace: z.string().min(1),
});

export const filePathParam = z.object({
  filePath: z.string().min(1),
});

export type NamespaceParam = z.infer<typeof namespaceParam>;
export type FilePathParam = z.infer<typeof filePathParam>;

export const createTagDto = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type CreateTagDto = z.infer<typeof createTagDto>;

export const updateTagDto = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export type UpdateTagDto = z.infer<typeof updateTagDto>;

export const setFileTagsDto = z.object({
  path: z.string().min(1),
  tags: z.array(z.string().min(1).max(40)),
});

export type SetFileTagsDto = z.infer<typeof setFileTagsDto>;

export const patchFileTagsDto = z.object({
  paths: z.array(z.string().min(1)).min(1),
  add: z.array(z.string().min(1).max(40)).optional(),
  remove: z.array(z.string().min(1).max(40)).optional(),
});

export type PatchFileTagsDto = z.infer<typeof patchFileTagsDto>;
