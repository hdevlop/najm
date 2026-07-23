import { Service } from 'najm-core';
import { GuardParams, Role as RequestRole } from "najm-core";
import { composeGuards, createGuard } from "najm-guard";
import { isAuth } from "../auth/AuthGuard";
import { ROLES, ROLE_GROUPS, type RoleInput } from "./constants";

// ============ ROLE GUARD ============ //

@Service()
export class RoleGuard {
  canActivate(@GuardParams() allowedRoles: RoleInput, @RequestRole() userRole: string) {
    if (!userRole) return false;

    const requiredRoles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const hasRole = requiredRoles.some(r => r.toLowerCase() === userRole.toLowerCase());

    if (hasRole) {
      return { role: userRole };
    }

    return false;
  }
}

// ============ EXPORTED GUARD DECORATORS ============ //

export const Role = createGuard(RoleGuard) as (roles: RoleInput) => any;

export const isAdmin = composeGuards(isAuth(), Role(ROLES.ADMIN));

// --- Role Groups ---
export const isAdministrator = composeGuards(isAuth(), Role(ROLE_GROUPS.ADMINISTRATORS));
