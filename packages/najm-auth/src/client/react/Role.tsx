import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';

interface RoleProps {
  /** Required role name */
  is?: string;
  /** Allow any of these roles */
  any?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Role-based conditional rendering gate.
 *
 * @example
 * ```tsx
 * <Role is="admin">
 *   <AdminPanel />
 * </Role>
 *
 * <Role any={['admin', 'editor']} fallback={<p>No access</p>}>
 *   <ContentEditor />
 * </Role>
 * ```
 */
export function Role(props: RoleProps) {
  const { is, any: anyRole, children, fallback = null } = props;
  const { hasRole, hasAnyRole } = usePermissions();

  const allowed = is
    ? hasRole(is)
    : anyRole
      ? hasAnyRole(anyRole)
      : false;

  return <>{allowed ? children : fallback}</>;
}
