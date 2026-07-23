import { Service, User } from 'najm-core';
import { createGuard } from 'najm-guard';

@Service()
export class AuthGuard {
  canActivate(@User() user: any): boolean {
    return !!user;
  }
}

export const isAuth = createGuard(AuthGuard);
