// The application's "backend", in process.
//
// Kafil reaches its Najm server with `server.fetch(new Request(...))`, so the
// fixture's fetcher is the same shape: a function from a path to a Response,
// with no loopback HTTP in the way. What it adds is a hit counter, which is
// the only way to tell one resolution per render apart from three.
//
// State lives on `globalThis` because Next bundles route handlers and pages
// into separate chunks: a module-level variable would not be the same variable
// on both sides of `/api/fixture/state`.

const KEY = '__najmKitUiBootstrapFixture';

interface Store {
  hits: { appearance: number; branding: number };
  diagnostics: string[];
  brandingStatus: number;
  revision: number;
}

function store(): Store {
  const holder = globalThis as { [KEY]?: Store };
  holder[KEY] ??= {
    hits: { appearance: 0, branding: 0 },
    diagnostics: [],
    brandingStatus: 200,
    revision: 7,
  };
  return holder[KEY];
}

export function readState(): Store {
  return store();
}

export function resetState(patch: Partial<Pick<Store, 'brandingStatus' | 'revision'>> = {}): void {
  const state = store();
  state.hits = { appearance: 0, branding: 0 };
  state.diagnostics = [];
  state.brandingStatus = patch.brandingStatus ?? 200;
  state.revision = patch.revision ?? state.revision;
}

export function recordDiagnostic(line: string): void {
  store().diagnostics.push(line);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export async function fixtureFetch(path: string): Promise<Response> {
  const state = store();

  if (path === '/api/appearance') {
    state.hits.appearance += 1;
    return json({
      data: {
        designConfig: { version: 1, theme: { preset: 'dark' }, typography: { baseSize: '15px' } },
        revision: state.revision,
      },
    });
  }

  if (path === '/api/branding') {
    state.hits.branding += 1;
    if (state.brandingStatus !== 200) {
      return json({ message: 'branding unavailable' }, state.brandingStatus);
    }
    return json({
      data: {
        sidebarLogoExpandedPath: '/uploaded-logo.png',
        revision: state.revision,
      },
    });
  }

  return json({ message: 'not found' }, 404);
}
