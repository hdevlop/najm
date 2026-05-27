import type { DefineAuthConfig } from 'najm-auth/client/server';

export const authConfig: DefineAuthConfig = {
  apiBaseURL: '/api',
  authPrefix: '/auth',
  refreshThreshold: 0.8,
  tabSync: true,
  loginRoute: '/login',
  afterLoginRoute: '/dashboard',
  publicRoutes: ['/', '/login', '/register', '/forgot-password', '/reset-password'],
  protectedRoutes: ['/dashboard/:path*', '/account/:path*', '/admin/:path*'],
  roleRoutes: {
    '/admin/:path*': ['admin'],
  },
};
