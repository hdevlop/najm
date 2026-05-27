import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';

interface CanProps {
  /** Required permission (e.g., 'read:posts') */
  permission?: string;
  /** Required role */
  role?: string;
  /** Rendered when the check passes */
  children: ReactNode;
  /** Rendered when the check fails (default: null) */
  fallback?: ReactNode;
}

/**
 * Declarative permission gate.
 *
 * @example
 * ```tsx
 * <Can permission="create:products">
 *   <CreateButton />
 * </Can>
 *
 * <Can role="admin" fallback={<UpgradePrompt />}>
 *   <AdminPanel />
 * </Can>
 * ```
 */
export function Can({ permission, role, children, fallback = null }: CanProps) {
  const { can, hasRole } = usePermissions();

  const allowed = permission
    ? can(permission)
    : role
      ? hasRole(role)
      : false;

  return <>{allowed ? children : fallback}</>;
}
