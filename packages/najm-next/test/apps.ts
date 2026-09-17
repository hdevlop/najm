/**
 * Shared Kafil-style and School-style app definitions for unit tests.
 * Mirrors the current consumer baselines (see the Phase 0 ledger):
 * optimistic + OSM imagery + `frame-src 'none'` vs authoritative + Google
 * origins. These are behavioral inputs only; production fixtures live in
 * `integration/csp-proxy/fixture`.
 */
import { defineNajmApp, type NajmAppDefinition } from "../src/app";

export function buildKafilStyleApp(): NajmAppDefinition {
  return defineNajmApp({
    id: "kafil-fixture",
    appName: "Kafil fixture",
    currency: "MAD",
    auth: {
      apiBaseURL: "/api",
      authPrefix: "/auth",
      publicRoutes: ["/", "/apply", "/login"],
      protectedRoutes: ["/dashboard", "/operator/:path*"],
      roleRoutes: { "/operator/:path*": ["admin", "operator"] },
      loginRoute: "/login",
      forbiddenRoute: "/forbidden",
      proxySessionMode: "optimistic",
      rememberCookieName: "kafil.remember",
      refreshThreshold: 0.8,
      tabSync: true,
    },
    preferences: {
      cookieNames: {
        language: "kafil-ui-language",
        theme: "kafil-ui-theme",
        timeZone: "kafil-ui-timezone",
      },
      defaultTimeZone: "Africa/Casablanca",
    },
    csp: {
      reportPath: "/api/csp-report",
      extraImgSrc: ["https://cdnjs.cloudflare.com", "https://tile.openstreetmap.org"],
      frameSrc: ["'none'"],
    },
    location: { environmentPrefix: "KAFIL_FIXTURE_LOCATION" },
  });
}

export function buildSchoolStyleApp(): NajmAppDefinition {
  return defineNajmApp({
    id: "school-fixture",
    appName: "School fixture",
    auth: {
      apiBaseURL: "/api",
      authPrefix: "/auth",
      publicRoutes: ["/login", "/register"],
      protectedRoutes: ["/", "/:path*"],
      loginRoute: "/login",
      forbiddenRoute: "/",
      proxySessionMode: "authoritative",
      rememberCookieName: "sms.remember",
      refreshThreshold: 0.8,
      tabSync: true,
    },
    preferences: {
      cookieNames: {
        language: "school-ui-language",
        theme: "school-ui-theme",
        timeZone: "school-ui-timezone",
      },
      defaultTimeZone: "Africa/Casablanca",
    },
    csp: {
      reportPath: "/api/csp-report",
      extraConnectSrc: ["https://*.googleapis.com", "https://*.google.com"],
      extraFontSrc: ["https://*.gstatic.com"],
      extraImgSrc: ["https://*.googleapis.com", "https://*.gstatic.com"],
      frameSrc: ["'self'", "https://www.google.com"],
    },
    location: { environmentPrefix: "SCHOOL_FIXTURE_LOCATION" },
  });
}
