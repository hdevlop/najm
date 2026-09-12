import { defineNajmApp } from 'najm-next/app';
import { defineNajmLocationRuntime } from 'najm-next/location/server';

/**
 * Kafil-style policy: optimistic proxy mode, OSM/CDN imagery, closed frames.
 * Mirrors `apps/web` without copying its files: the mechanics below come
 * from the built `najm-next` exports, only the policy values are app-owned.
 */
export const kafilStyleApp = defineNajmApp({
  id: 'kafil-fixture',
  auth: {
    apiBaseURL: '/api',
    authPrefix: '/auth',
    publicRoutes: ['/', '/kafil', '/login'],
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
    extraImgSrc: ['https://cdnjs.cloudflare.com', 'https://tile.openstreetmap.org'],
    frameSrc: ["'none'"],
  },
  location: { environmentPrefix: 'KAFIL_FIXTURE_LOCATION' },
});

/**
 * School-style policy: authoritative proxy mode with the Google provider
 * allowlist. Location stays disabled here (shared Google runtime is Phase 3
 * work); the provider origins are explicit app policy, as in the consumer.
 */
export const schoolStyleApp = defineNajmApp({
  id: 'school-fixture',
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
    extraConnectSrc: ['https://*.googleapis.com', 'https://*.google.com'],
    extraFontSrc: ['https://*.gstatic.com'],
    extraImgSrc: ['https://*.googleapis.com', 'https://*.gstatic.com'],
    frameSrc: ["'self'", 'https://www.google.com'],
  },
  location: { environmentPrefix: 'SCHOOL_FIXTURE_LOCATION' },
});

export const kafilLocation = defineNajmLocationRuntime({
  environmentPrefix: 'KAFIL_FIXTURE_LOCATION',
  allowedProviders: ['leaflet'],
  defaults: {
    provider: 'leaflet',
    center: { latitude: 33.5731, longitude: -7.5898 },
    zoom: 12,
    leaflet: {
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: 'OpenStreetMap contributors',
    },
  },
});

export const schoolLocation = defineNajmLocationRuntime({
  environmentPrefix: 'SCHOOL_FIXTURE_LOCATION',
  allowedProviders: ['disabled'],
  defaults: {
    provider: 'disabled',
    center: { latitude: 33.5731, longitude: -7.5898 },
  },
});
