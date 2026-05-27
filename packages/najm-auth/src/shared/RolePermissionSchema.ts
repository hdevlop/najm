// ============================================================================
// DEPRECATED: This file is kept for backward compatibility only
// Please import from the centralized schema files:
// - import { rolePermissionsTable, RolePermission, NewRolePermission } from 'najm-auth/pg'
// - import { rolePermissionsTable, RolePermission, NewRolePermission } from 'najm-auth/sqlite'
// - import { rolePermissionsTable, RolePermission, NewRolePermission } from 'najm-auth/mysql'
// ============================================================================

// Re-export from centralized schema (PostgreSQL by default)
export { rolePermissionsTable, type RolePermission, type NewRolePermission } from '../schema/pg';
