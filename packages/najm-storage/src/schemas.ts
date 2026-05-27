import { z } from 'zod';
import type { FileInfo, StorageFileDto } from './types';

export const storageNamespaceSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes('..') && !/[\\/]/.test(value), 'Invalid namespace');

export const storagePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !value.includes('..') && !value.startsWith('/') && !value.startsWith('\\') && !value.includes('\0'),
    'Invalid storage path',
  );

export const storageUploadSchema = z.object({
  filePath: storagePathSchema,
  mimeType: z.string().min(1).optional(),
  size: z.number().int().nonnegative(),
});

export function toStorageFileDto(fileInfo: FileInfo): StorageFileDto {
  return {
    namespace: fileInfo.namespace,
    path: fileInfo.filePath,
    mimeType: fileInfo.mimeType,
    size: fileInfo.size,
    category: fileInfo.category,
    createdAt: fileInfo.createdAt,
    updatedAt: fileInfo.updatedAt,
  };
}
