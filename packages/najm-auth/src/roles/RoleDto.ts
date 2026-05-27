import { z } from 'zod';

// Field validations
const nameField = z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long');
const descriptionField = z.string().max(255, 'Description too long').optional();

// DTOs for role operations
export const createRoleDto = z.object({
  name: nameField,
  description: descriptionField,
});

export const updateRoleDto = createRoleDto.partial();

export const roleIdParam = z.object({
  id: z.string().length(5, 'Role ID must be 5 characters'),
});

export const assignRoleDto = z.object({
  userId: z.string().length(8, 'User ID must be 8 characters'),
  roleId: z.string().length(5, 'Role ID must be 5 characters'),
});

// Inferred types
export type CreateRoleDto = z.infer<typeof createRoleDto>;
export type UpdateRoleDto = z.infer<typeof updateRoleDto>;
export type RoleIdParam = z.infer<typeof roleIdParam>;
export type AssignRoleDto = z.infer<typeof assignRoleDto>;
