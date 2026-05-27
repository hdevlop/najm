// ============================================================================
// Client-side Permission Matching
// ============================================================================
// Supports wildcard patterns: '*:*', 'create:*', '*:posts'

/**
 * Check if a user's permissions include the required permission.
 * Supports wildcards:
 * - `*:*` matches everything
 * - `create:*` matches any resource with create action
 * - `*:posts` matches any action on posts resource
 */
export function matchPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*:*')) return true;
  if (userPermissions.includes(required)) return true;

  const sep = required.indexOf(':');
  if (sep === -1) return false;

  const action = required.slice(0, sep);
  const resource = required.slice(sep + 1);

  return (
    userPermissions.includes(`${action}:*`) ||
    userPermissions.includes(`*:${resource}`)
  );
}

/**
 * Check if user has a specific role.
 */
export function hasRole(userRoles: string[], role: string): boolean {
  return userRoles.includes(role);
}

/**
 * Check if user has any of the specified roles.
 */
export function hasAnyRole(userRoles: string[], roles: string[]): boolean {
  return roles.some((r) => userRoles.includes(r));
}
