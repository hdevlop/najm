import 'server-only';

import { cookies, headers } from 'next/headers';
import { createNajmServerApp } from 'najm-next/app/server';

import { kafilStyleApp, schoolStyleApp } from './najm.config';
import { countHit, readState, recordDiagnostic } from './uiBackend';

/**
 * The application's two module-scope server bootstraps.
 *
 * Created here and nowhere else: calling the factory inside a layout would
 * build a fresh memoization entry per render and share nothing, which is
 * exactly what this fixture measures. Both styles share the single
 * `resolveFixturePreferences` implementation below — never a duplicated
 * resolver.
 */

export interface FixturePreferences {
  language: string;
  theme: string;
  timeZone: string;
  currency: string;
}

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'es'] as const;
const SUPPORTED_TIME_ZONES = ['Africa/Casablanca', 'Europe/Paris', 'UTC'] as const;
const SUPPORTED_CURRENCIES = ['MAD', 'EUR', 'USD'] as const;

function firstValid(candidates: readonly unknown[], guard: (v: unknown) => boolean): unknown {
  for (const candidate of candidates) {
    if (guard(candidate)) return candidate;
  }
  return undefined;
}

/**
 * The one shared preference selection. Kafil-style passes no institution and
 * an Accept-Language header; School-style passes an institution projection
 * and no header. Currency reads only the institution value in both cases.
 */
function resolveFixturePreferences(input: {
  style: 'kafil' | 'school';
  cookieLanguage?: string;
  cookieTheme?: string;
  cookieTimeZone?: string;
  userLanguage?: unknown;
  userTheme?: unknown;
  userTimeZone?: unknown;
  institutionLanguage?: unknown;
  institutionTheme?: unknown;
  institutionTimeZone?: unknown;
  institutionCurrency?: unknown;
  acceptLanguage?: string | null;
}): FixturePreferences {
  const isLanguage = (v: unknown): v is string =>
    typeof v === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
  const isTheme = (v: unknown): v is string => v === 'light' || v === 'dark';
  const isTimeZone = (v: unknown): v is string =>
    typeof v === 'string' && (SUPPORTED_TIME_ZONES as readonly string[]).includes(v);
  const isCurrency = (v: unknown): v is string =>
    typeof v === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(v);

  let accepted: string | undefined;
  if (input.acceptLanguage) {
    for (const entry of input.acceptLanguage.split(',')) {
      const tag = entry.split(';')[0]?.trim().toLowerCase() ?? '';
      const base = tag.split('-')[0];
      const match = (SUPPORTED_LANGUAGES as readonly string[]).find((l) => l === tag || l === base);
      if (match) {
        accepted = match;
        break;
      }
    }
  }

  const language =
    (firstValid(
      [input.cookieLanguage, input.userLanguage, input.institutionLanguage],
      isLanguage,
    ) as string | undefined) ??
    accepted ??
    'en';
  const theme =
    (firstValid([input.cookieTheme, input.userTheme, input.institutionTheme], isTheme) as
      | string
      | undefined) ?? 'light';
  const timeZone =
    (firstValid(
      [input.cookieTimeZone, input.userTimeZone, input.institutionTimeZone],
      isTimeZone,
    ) as string | undefined) ?? 'Africa/Casablanca';
  const currency =
    (firstValid([input.institutionCurrency], isCurrency) as string | undefined) ?? 'MAD';

  return { language, theme, timeZone, currency };
}

export interface FixtureUser {
  language?: unknown;
  theme?: unknown;
  timeZone?: unknown;
}

function sessionFor(cookieValue: string | undefined): { user: FixtureUser } | null {
  if (!cookieValue) return null;
  if (cookieValue === 'kafil-fr') return { user: { language: 'fr' } };
  if (cookieValue === 'kafil-ar') return { user: { language: 'ar' } };
  if (cookieValue === 'school-es') return { user: { language: 'es' } };
  if (cookieValue === 'school-ar') return { user: { language: 'ar', theme: 'dark' } };
  return null;
}

function operationalError(): Error {
  const error = new Error('session recovery unavailable');
  error.name = 'AuthTransportError';
  return error;
}

async function readFixtureCookies() {
  countHit('cookies');
  return cookies();
}

async function readFixtureHeaders() {
  countHit('headers');
  return headers();
}

function stubAuth(style: 'kafil' | 'school') {
  return {
    async getSession() {
      countHit('session');
      const state = readState();
      if (state.sessionError) {
        // Kafil-style resolves operational failures to anonymous; School-style
        // propagates them. The package itself never catches — the policy lives
        // in the auth callback the app bound.
        if (style === 'kafil') return null;
        throw operationalError();
      }
      const store = await cookies();
      return sessionFor(store.get('fixture-session')?.value);
    },
    async requireSession() {
      countHit('session');
      const session = await stubAuth(style).getSession();
      if (session) return session;
      throw new Error('NO_SESSION');
    },
    async requireRole(roles: readonly string[]) {
      const session = await stubAuth(style).requireSession();
      void roles;
      return session;
    },
  };
}

function stubTheme() {
  return {
    async loadAppearance() {
      countHit('appearance');
      const state = readState();
      if (state.appearanceStatus !== 200) {
        recordDiagnostic(`appearance:response-not-ok:${state.appearanceStatus}`);
        return { revision: 1 };
      }
      return { revision: state.revision };
    },
    async loadBranding() {
      countHit('branding');
      const state = readState();
      if (state.brandingStatus !== 200) {
        recordDiagnostic(`branding:response-not-ok:${state.brandingStatus}`);
        return { logo: '/factory-logo.svg' };
      }
      return { logo: '/uploaded-logo.png' };
    },
  };
}

export const kafilServer = createNajmServerApp({
  app: kafilStyleApp,
  auth: stubAuth('kafil'),
  theme: stubTheme(),
  readSettings: async () => {
    countHit('settings');
    const state = readState();
    if (state.settingsError) throw new Error('settings backend unavailable');
    return { enabled: state.kafilEnabled };
  },
  fallbackSettings: { enabled: false },
  readCookies: readFixtureCookies,
  readHeaders: readFixtureHeaders,
  onDiagnostic: (diagnostic) => {
    recordDiagnostic(`settings:${diagnostic.code}:${diagnostic.detail ?? ''}`);
  },
  resolvePreferences: async ({ cookies: cookieStore, headers: headerStore, session }) => {
    const user = (session?.user ?? {}) as FixtureUser;
    return resolveFixturePreferences({
      style: 'kafil',
      cookieLanguage: cookieStore.get('kafil-ui-language')?.value,
      cookieTheme: cookieStore.get('kafil-ui-theme')?.value,
      cookieTimeZone: cookieStore.get('kafil-ui-timezone')?.value,
      userLanguage: user.language,
      userTheme: user.theme,
      userTimeZone: user.timeZone,
      acceptLanguage: headerStore.get('accept-language'),
    });
  },
});

export const schoolServer = createNajmServerApp({
  app: schoolStyleApp,
  auth: stubAuth('school'),
  theme: stubTheme(),
  readSettings: async () => {
    countHit('settings');
    const state = readState();
    if (state.settingsError) throw new Error('settings backend unavailable');
    return {
      language: 'es',
      theme: 'light',
      timeZone: 'UTC',
      currency: state.schoolCurrency,
    };
  },
  fallbackSettings: null,
  readCookies: readFixtureCookies,
  readHeaders: readFixtureHeaders,
  onDiagnostic: (diagnostic) => {
    recordDiagnostic(`settings:${diagnostic.code}:${diagnostic.detail ?? ''}`);
  },
  resolvePreferences: async ({ cookies: cookieStore, session, settings }) => {
    const user = (session?.user ?? {}) as FixtureUser;
    const institution = (settings ?? {}) as {
      language?: unknown;
      theme?: unknown;
      timeZone?: unknown;
      currency?: unknown;
    };
    return resolveFixturePreferences({
      style: 'school',
      cookieLanguage: cookieStore.get('school-ui-language')?.value,
      cookieTheme: cookieStore.get('school-ui-theme')?.value,
      cookieTimeZone: cookieStore.get('school-ui-timezone')?.value,
      userLanguage: user.language,
      userTheme: user.theme,
      userTimeZone: user.timeZone,
      institutionLanguage: institution.language,
      institutionTheme: institution.theme,
      institutionTimeZone: institution.timeZone,
      institutionCurrency: institution.currency,
    });
  },
});

export const loadKafilSettings = kafilServer.loadSettings;
export const loadKafilSnapshot = kafilServer.loadUiSnapshot;
export const loadSchoolSettings = schoolServer.loadSettings;
export const loadSchoolSnapshot = schoolServer.loadUiSnapshot;
