import { composeGuards, createGuard } from 'najm-guard';
import { isAuth } from '../auth';
import { RoleGuard } from './RoleGuards';

const Role = createGuard<string | string[]>(RoleGuard);

// ============================================================================
// Type Definitions
// ============================================================================

type IsGuards<T extends Record<string, string>> = {
  [K in keyof T as `is${Capitalize<Lowercase<string & K>>}`]: () => ClassDecorator & MethodDecorator;
};

export interface DefineRolesOptions<T extends Record<string, string>> {
  /**
   * Role keys that should implicitly pass every generated role guard, group guard,
   * and service-layer role check created by defineRoles.
   */
  superRoles?: Array<keyof T>;
}

interface DefineRolesResult<T extends Record<string, string>> {
  /** The original roles record */
  ROLES: T;

  /** Create a guard that allows any of the specified role keys */
  createGroupGuard(keys: Array<keyof T>): () => ClassDecorator & MethodDecorator;

  /** Service-layer check: does userRole match any of the given role keys? */
  hasRole(userRole: string | null | undefined, ...keys: Array<keyof T>): boolean;

  /** Service-layer check: is userRole in the given group of role keys? */
  isInGroup(userRole: string | null | undefined, keys: Array<keyof T>): boolean;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Define application roles and generate typed guards + utilities.
 *
 * @example
 * ```ts
 * const { ROLES, isAdmin, isTeacher, createGroupGuard, hasRole } = defineRoles({
 *   ADMIN: 'admin',
 *   TEACHER: 'teacher',
 *   STUDENT: 'student',
 * }, {
 *   superRoles: ['ADMIN'],
 * });
 *
 * // HTTP guards
 * const isStaff = createGroupGuard(['ADMIN', 'TEACHER']);
 *
 * // Service-layer checks
 * if (hasRole(user.role, 'ADMIN', 'TEACHER')) { ... }
 * ```
 */
export function defineRoles<T extends Record<string, string>>(
  roles: T,
  options?: DefineRolesOptions<T>,
): DefineRolesResult<T> & IsGuards<T> {
  const ROLES = roles;
  const superRoleKeys = options?.superRoles ?? [];

  function resolveRoleValues(keys: Array<keyof T>): string[] {
    return Array.from(
      new Set([...keys, ...superRoleKeys].map(key => roles[key] as string)),
    );
  }

  // Generate per-role guards: isAdmin(), isTeacher(), etc.
  const guards = {} as Record<string, any>;
  for (const [key, value] of Object.entries(roles)) {
    const name = `is${key.charAt(0).toUpperCase()}${key.slice(1).toLowerCase()}`;
    const allowedValues = resolveRoleValues([key as keyof T]);
    guards[name] = composeGuards(isAuth(), Role((allowedValues.length === 1 ? value : allowedValues) as any));
  }

  function createGroupGuard(keys: Array<keyof T>) {
    const values = resolveRoleValues(keys);
    return composeGuards(isAuth(), Role(values as any));
  }

  function hasRole(userRole: string | null | undefined, ...keys: Array<keyof T>): boolean {
    if (!userRole) return false;
    const normalized = userRole.toLowerCase();
    return resolveRoleValues(keys).some(role => role === normalized);
  }

  function isInGroup(userRole: string | null | undefined, keys: Array<keyof T>): boolean {
    return hasRole(userRole, ...keys);
  }

  return { ROLES, createGroupGuard, hasRole, isInGroup, ...guards } as any;
}
