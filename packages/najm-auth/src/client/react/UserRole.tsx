import { usePermissions } from './usePermissions';

interface UserRoleProps {
  fallback?: string;
}

/**
 * Renders the user's primary role name.
 *
 * @example
 * ```tsx
 * <span>Role: <UserRole fallback="none" /></span>
 * ```
 */
export function UserRole({ fallback = '' }: UserRoleProps) {
  const { roles } = usePermissions();
  return <>{roles[0] ?? fallback}</>;
}
