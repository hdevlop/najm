import { useAuthClient } from './context';
import { useAuth } from './useAuth';

interface UsePermissionsReturn {
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  permissions: string[];
  roles: string[];
}

/**
 * Access RBAC/PBAC checks as hooks.
 * Permissions are decoded from JWT — no round-trip needed.
 */
export function usePermissions(): UsePermissionsReturn {
  const client = useAuthClient();
  const { permissions, roles } = useAuth();

  return {
    can: (p: string) => client.can(p),
    hasRole: (r: string) => client.hasRole(r),
    hasAnyRole: (rs: string[]) => client.hasAnyRole(rs),
    permissions,
    roles,
  };
}
