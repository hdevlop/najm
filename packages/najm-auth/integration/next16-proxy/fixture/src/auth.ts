import { defineAuth } from 'najm-auth/client/server';

const explicitInternalURL = process.env.FIXTURE_INTERNAL_RECOVERY_URL || undefined;

export const auth = defineAuth({
  protectedRoutes: ['/protected', '/admin'],
  publicRoutes: ['/', '/login'],
  roleRoutes: {
    '/admin': ['admin'],
  },
  loginRoute: '/login',
  apiBaseURL: '/api',
  authPrefix: '/auth',
  proxySessionMode: 'authoritative',
  internalRecoveryURL: explicitInternalURL,
  onRecoveryFailure(failure) {
    console.error('NAJM_RECOVERY_FAILURE', JSON.stringify(failure));
    if (process.env.FIXTURE_THROW_DIAGNOSTIC === '1') {
      throw new Error('fixture diagnostic callback failure');
    }
  },
});
