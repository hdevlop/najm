import { Injectable } from 'najm-core';
import { GuardParams, User } from "najm-core";
import { createGuard, composeGuards, GuardResult } from "najm-guard";
import { isAuth } from "../auth";

@Injectable()
export class PermissionGuard {
  
  canActivate(
    @GuardParams() requiredPermission: string, 
    @User('permissions') permissions: string[]
  ): GuardResult | false {
    if (!permissions || !Array.isArray(permissions)) return false;
    
    const hasPermission = this.checkPermission(permissions, requiredPermission);
    
    if (hasPermission) {
      return { permissions };
    }
    
    return false;
  }

  private checkPermission(permissions: string[], required: string): boolean {
    if (permissions.includes(required)) return true;
    if (permissions.includes('*:*')) return true;

    const [action, resource] = required.split(':');
    if (action && resource) {
      if (permissions.includes(`${action}:*`)) return true;
      if (permissions.includes(`*:${resource}`)) return true;
    }

    return false;
  }
}

const Permission = createGuard<string>(PermissionGuard);

export const Can = (permission: string) => composeGuards(isAuth(), Permission(permission))();
