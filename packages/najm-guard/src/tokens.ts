// ============================================================================
// tokens.ts - Guard ALS tokens and metadata keys (REFACTORED)
// ============================================================================

import { createAlsToken } from 'najm-core';

// ============================================================================
// ALS TOKENS - For guard context accessible via @User, @Owner, etc.
// ============================================================================

/**
 * User data populated by authentication guards
 * Use generic type to maintain type safety in your app:
 *
 * @example
 * ```ts
 * // In your app
 * interface UserData { id: string; roles: string[]; }
 *
 * @Service()
 * class AuthGuard {
 *    canActivate(@Headers('auth') token: string, @Ctx() ctx: Context): boolean {
 *       const user = verifyToken(token);
 *       ctx.set(USER.name, user);  // Populate user context
 *       return !!user;
 *    }
 * }
 *
 * // In your controller
 * @Get('/profile')
 * getProfile(@User() user: UserData) {  // Type-safe!
 *    return { id: user.id };
 * }
 * ```
 */
export const USER = createAlsToken<any>('user');

/**
 * User role populated by authorization guards
 * Use to get the current user's role
 *
 * @example
 * ```ts
 * @Get('/admin')
 * async getAdmin(@Role() role: string) {
 *    if (role !== 'admin') throw new HttpError(403, 'Forbidden');
 *    return { data: 'admin-only' };
 * }
 * ```
 */
export const ROLE = createAlsToken<string>('role');

/**
 * User permissions populated by authorization guards
 * Use to get the current user's permissions
 *
 * @example
 * ```ts
 * @Get('/edit/:id')
 * async editResource(
 *    @Params('id') id: string,
 *    @Permissions() permissions: string[]
 * ) {
 *    if (!permissions.includes('edit:resource')) {
 *       throw new HttpError(403, 'Forbidden');
 *    }
 *    return { id };
 * }
 * ```
 */
export const PERMISSIONS = createAlsToken<string[]>('permissions');

/**
 * Resource owner data (for ownership-based guards)
 */
export const OWNER = createAlsToken<any>('owner');

/**
 * Additional info populated by guards
 */
export const INFO = createAlsToken<any>('info');

/**
 * Generic data storage for guards
 */
export const DATA = createAlsToken<any>('data');

/**
 * Filter criteria (for query/permission filtering)
 */
export const FILTER = createAlsToken<any>('filter');

/**
 * Guard parameters passed to guard decorators
 * This is populated automatically by the guard system
 */
export const GUARD_PARAMS = createAlsToken<any>('guardParams');

// ============================================================================
// METADATA KEYS
// ============================================================================

/**
 * Metadata key for guards applied to class/method
 */
export const GUARDS_META = Symbol.for('najm:guards:meta');

/**
 * Plugin config token
 */
export const GUARD_CONFIG = Symbol.for('najm:GUARD_CONFIG');
