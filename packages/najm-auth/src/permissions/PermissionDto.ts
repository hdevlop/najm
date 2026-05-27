import { z } from 'zod';

// Field validations
const nameField = z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long');
const descriptionField = z.string().max(255, 'Description too long').optional();
const resourceField = z.string().min(1, 'Resource is required').max(50, 'Resource too long');
const actionField = z.string().min(1, 'Action is required').max(50, 'Action too long');

// DTOs for permission operations
export const createPermissionDto = z.object({
  name: nameField,
  description: descriptionField,
  resource: resourceField,
  action: actionField,
});

export const updatePermissionDto = createPermissionDto.partial();

export const permissionIdParam = z.object({
  id: z.string().length(5, 'Permission ID must be 5 characters'),
});

export const assignPermissionDto = z.object({
  roleId: z.string().length(5, 'Role ID must be 5 characters'),
  permissionId: z.string().length(5, 'Permission ID must be 5 characters'),
});

export const checkPermissionDto = z.object({
  userId: z.string().length(8, 'User ID must be 8 characters'),
  resource: resourceField,
  action: actionField,
});

// Inferred types
export type CreatePermissionDto = z.infer<typeof createPermissionDto>;
export type UpdatePermissionDto = z.infer<typeof updatePermissionDto>;
export type PermissionIdParam = z.infer<typeof permissionIdParam>;
export type AssignPermissionDto = z.infer<typeof assignPermissionDto>;
export type CheckPermissionDto = z.infer<typeof checkPermissionDto>;
