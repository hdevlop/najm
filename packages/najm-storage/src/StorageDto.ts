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
