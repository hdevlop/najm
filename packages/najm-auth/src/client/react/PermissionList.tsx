import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';

interface PermissionListProps {
  /** Render function for each permission */
  children: (permission: string, index: number) => ReactNode;
  /** Rendered when the user has no permissions */
  fallback?: ReactNode;
}

/**
 * Iterates over the user's permissions with a render function.
 *
 * @example
 * ```tsx
 * <PermissionList fallback={<p>No permissions</p>}>
 *   {(perm) => <Badge key={perm}>{perm}</Badge>}
 * </PermissionList>
 * ```
 */
export function PermissionList({ children, fallback = null }: PermissionListProps) {
  const { permissions } = usePermissions();

  if (permissions.length === 0) return <>{fallback}</>;

  return <>{permissions.map((perm, i) => children(perm, i))}</>;
}
