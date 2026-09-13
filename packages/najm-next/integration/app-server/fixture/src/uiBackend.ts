// The application's "backend", in process.
//
// State lives on `globalThis` because Next bundles route handlers and pages
// into separate chunks: a module-level variable would not be the same variable
// on both sides of `/api/fixture/state`.

const KEY = '__najmNextAppServerFixture';

export interface Store {
  hits: { session: number; cookies: number; headers: number; appearance: number; branding: number; settings: number };
  diagnostics: string[];
  appearanceStatus: number;
  brandingStatus: number;
  settingsError: boolean;
  sessionError: boolean;
  revision: number;
  kafilEnabled: boolean;
  schoolCurrency: string;
}

function store(): Store {
  const holder = globalThis as { [KEY]?: Store };
  holder[KEY] ??= {
    hits: { session: 0, cookies: 0, headers: 0, appearance: 0, branding: 0, settings: 0 },
    diagnostics: [],
    appearanceStatus: 200,
    brandingStatus: 200,
    settingsError: false,
    sessionError: false,
    revision: 7,
    kafilEnabled: true,
    schoolCurrency: 'EUR',
  };
  return holder[KEY];
}

export function readState(): Store {
  return store();
}

export function resetState(
  patch: Partial<Pick<Store, 'appearanceStatus' | 'brandingStatus' | 'settingsError' | 'sessionError' | 'revision' | 'kafilEnabled' | 'schoolCurrency'>> = {},
): void {
  const state = store();
  state.hits = { session: 0, cookies: 0, headers: 0, appearance: 0, branding: 0, settings: 0 };
  state.diagnostics = [];
  state.appearanceStatus = patch.appearanceStatus ?? 200;
  state.brandingStatus = patch.brandingStatus ?? 200;
  state.settingsError = patch.settingsError ?? false;
  state.sessionError = patch.sessionError ?? false;
  state.revision = patch.revision ?? state.revision;
  state.kafilEnabled = patch.kafilEnabled ?? state.kafilEnabled;
  state.schoolCurrency = patch.schoolCurrency ?? state.schoolCurrency;
}

export function recordDiagnostic(line: string): void {
  store().diagnostics.push(line);
}

export function countHit(name: keyof Store['hits']): void {
  store().hits[name] += 1;
}
