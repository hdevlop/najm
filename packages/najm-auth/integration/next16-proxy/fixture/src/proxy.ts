import { withAuthMiddleware } from 'najm-auth/client/edge';

export default withAuthMiddleware({
  protectedRoutes: ['/protected'],
  publicRoutes: ['/', '/login'],
  loginRoute: '/login',
  apiBaseURL: '/api',
  authPrefix: '/auth',
  verifyAlways: true,
  onRecoveryFailure(failure) {
    console.error('[najm-auth:recovery]', JSON.stringify(failure));
  },
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
