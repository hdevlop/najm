import { Service, User } from 'najm-core';
import { createGuard } from 'najm-guard';

@Service()
export class AuthGuard {
  /**
   * A resolved principal is not automatically an authorized one.
   *
   * The resolvers ahead of this guard already reject deactivated accounts, so
   * this is the backstop for anything that publishes a principal by another
   * route: a truthy user record must still be an active one to pass. Records
   * whose projection omits `status` are unchanged.
   */
  canActivate(@User() user: any): boolean {
    if (!user) return false;
    return user.status === undefined || user.status === 'active';
  }
}

export const isAuth = createGuard(AuthGuard);
