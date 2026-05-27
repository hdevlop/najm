import { withAuthMiddleware } from 'najm-auth/client/edge';
import { authConfig } from '@/lib/auth-config';

export const middleware = withAuthMiddleware(authConfig);
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
