import type { DefineAuthConfig } from 'najm-auth/client/server';

export const authConfig: DefineAuthConfig = {
  apiBaseURL: '/api',
  authPrefix: '/auth',
  refreshThreshold: 0.8,
  tabSync: true,
  loginRoute: '/login',
  afterLoginRoute: '/dashboard',
  // `/change-password` is public on purpose: a user in credential setup holds
  // only the opaque setup cookie, never a session.
  publicRoutes: ['/', '/login', '/register', '/forgot-password', '/reset-password', '/change-password', '/format-pagination', '/auth/oauth/callback'],
  protectedRoutes: ['/dashboard/:path*', '/account/:path*', '/admin/:path*'],
  roleRoutes: {
    '/admin/:path*': ['admin'],
  },
};
