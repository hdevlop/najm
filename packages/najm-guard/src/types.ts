// ============================================================================
// types.ts - Guard types (UPDATED)
// ============================================================================

import type { Constructor } from 'najm-core';

/**
 * Structured guard result for automatic ALS token setting.
 * Return this from canActivate() to automatically set tokens.
 *
 * @example
 * ```ts
 * async canActivate(@Headers('auth') token: string) {
 *   const user = await this.auth.verify(token);
 *   if (!user) return false;
 *   return { user, role: 'admin', permissions: ['read', 'write'] };  // Auto-sets tokens
 * }
 * ```
 */
export interface GuardResult {
   /** User data → accessible via @User() decorator */
   user?: any;
   /** Owner data → accessible via @Owner() decorator */
   owner?: any;
   /** Additional info → accessible via @Info() decorator */
   info?: any;
   /** Generic data storage → accessible via @Data() decorator */
   data?: any;
   /** Filter criteria → accessible via @Filter() decorator */
   filter?: any;
   /** User role → accessible via @Role() decorator */
   role?: string;
   /** User permissions → accessible via @Permissions() decorator */
   permissions?: string[];
}

/**
 * Guard method return type
 * - `false` → Guard failed, request rejected
 * - `true` → Guard passed, no tokens set
 * - `GuardResult` → Guard passed, tokens auto-set
 */
export type GuardReturnType = boolean | GuardResult;

/**
 * Guard metadata stored by decorators
 */
export interface GuardMetadata {
   guardClass: Constructor;
   methodName: string;
   params?: any;
}

/**
 * Plugin configuration
 */
export type GuardPluginConfig = boolean | {
   /** Enable/disable guard plugin */
   enabled?: boolean;
   /** Paths to exclude from guards (supports wildcards) */
   exclude?: string[];
};

/**
 * Composite guard params for AND/OR logic
 */
export interface CompositeGuardParams {
   type: 'AND' | 'OR';
   guards: GuardMetadata[];
}

/**
 * Options for createGuard factory
 */
export interface CreateGuardOptions {
   methodName?: string;
}
