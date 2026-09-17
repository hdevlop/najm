import { defineNajmApp } from 'najm-next/app';

/**
 * Kafil-style policy: optimistic proxy mode, closed frames. Session failures
 * resolve to anonymous in the server fixture below (mirroring the current
 * Kafil layout catch-all, mapped to explicit classification).
 */
export const kafilStyleApp = defineNajmApp({
  id: 'kafil-fixture',
  appName: 'Kafil fixture',
  currency: 'MAD',
  auth: {
    apiBaseURL: '/api',
    authPrefix: '/auth',
    publicRoutes: ['/', '/kafil', '/session-only', '/login'],
    protectedRoutes: ['/protected'],
    loginRoute: '/login',
    forbiddenRoute: '/forbidden',
    proxySessionMode: 'optimistic',
    rememberCookieName: 'kafil.remember',
    refreshThreshold: 0.8,
    tabSync: true,
  },
  preferences: {
    cookieNames: {
      language: 'kafil-ui-language',
      theme: 'kafil-ui-theme',
      timeZone: 'kafil-ui-timezone',
    },
    defaultTimeZone: 'Africa/Casablanca',
  },
  csp: {
    reportPath: '/api/csp-report',
    frameSrc: ["'none'"],
  },
  location: { environmentPrefix: 'KAFIL_FIXTURE_LOCATION' },
});

/**
 * School-style policy: authoritative proxy mode. Operational session
 * failures propagate in the server fixture below (mirroring the current
 * School layout propagation).
 */
export const schoolStyleApp = defineNajmApp({
  id: 'school-fixture',
  appName: 'School fixture',
  auth: {
    apiBaseURL: '/api',
    authPrefix: '/auth',
    publicRoutes: ['/login', '/school'],
    protectedRoutes: ['/protected'],
    loginRoute: '/login',
    forbiddenRoute: '/',
    proxySessionMode: 'authoritative',
    rememberCookieName: 'sms.remember',
    refreshThreshold: 0.8,
    tabSync: true,
  },
  preferences: {
    cookieNames: {
      language: 'school-ui-language',
      theme: 'school-ui-theme',
      timeZone: 'school-ui-timezone',
    },
    defaultTimeZone: 'Africa/Casablanca',
  },
  csp: {
    reportPath: '/api/csp-report',
    frameSrc: ["'self'"],
  },
  location: { environmentPrefix: 'SCHOOL_FIXTURE_LOCATION' },
});
