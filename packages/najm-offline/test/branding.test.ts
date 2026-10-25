import { expect, test } from 'bun:test';
import { cacheShellBranding, SHELL_BRANDING_CACHE, withCachedBranding } from './support/app';

const origin = 'https://app.test';
const logo = (path: string) => `${origin}/api/theme/branding/${path}`;
const png = (body = 'logo') => new Response(body, { headers: { 'content-type': 'image/png' } });

function cacheStorage(initial: Record<string, Response> = {}) {
  const entries = new Map(Object.entries(initial));
  const opened: string[] = [];
  const cache = {
    put: async (url: string, response: Response) => { entries.set(url, response); },
    match: async (url: string) => entries.get(url)?.clone(),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => entries.delete(request.url),
  } as unknown as Cache;
  return { entries, opened, storage: { open: async (name: string) => { opened.push(name); return cache; } } };
}

function recordingFetch(response: () => Response) {
  const requested: string[] = [];
  const request = (async (url: string) => { requested.push(url); return response(); }) as unknown as typeof fetch;
  return { requested, request };
}

test('preparation stores the current sidebar logos and drops a replaced one', async () => {
  const { entries, opened, storage } = cacheStorage({ [logo('old.png')]: png('old') });
  const { requested, request } = recordingFetch(() => png());
  await cacheShellBranding({ slots: { sidebarLogoExpanded: '/api/theme/branding/expanded.png', sidebarLogoCollapsed: '/api/theme/branding/collapsed.png', authLogo: '/api/theme/branding/auth.png' } },
    origin, storage, request);
  expect(opened).toEqual([SHELL_BRANDING_CACHE]);
  expect(requested).toEqual([logo('expanded.png'), logo('collapsed.png')]);
  expect([...entries.keys()].sort()).toEqual([logo('collapsed.png'), logo('expanded.png')]);
});

test('stored factory and uploaded logos are not downloaded again; a new one replaces its old copy', async () => {
  const factory = `${origin}/api/branding/factory/sidebarLogoExpanded.0bf36a53c9c66ad4.png`;
  const upload = `${origin}/api/branding/assets/5b0c2f9e-3a41-4c7e-9a3e-1f2d3c4b5a69.png`;
  const replaced = `${origin}/api/branding/assets/0a6e1c2b-7d88-4f0e-b1c5-9e8d7c6b5a43.png`;
  const { entries, storage } = cacheStorage({ [factory]: png('factory'), [upload]: png('upload'), [replaced]: png('replaced') });
  const { requested, request } = recordingFetch(() => png());
  const slots = { sidebarLogoExpanded: new URL(factory).pathname, sidebarLogoCollapsed: new URL(upload).pathname };
  await cacheShellBranding({ slots }, origin, storage, request);
  expect(requested).toEqual([]);
  const next = `${origin}/api/branding/assets/9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f.png`;
  await cacheShellBranding({ slots: { ...slots, sidebarLogoCollapsed: new URL(next).pathname } }, origin, storage, request);
  expect(requested).toEqual([next]);
  expect([...entries.keys()].sort()).toEqual([factory, next].sort());
});

test('a failed or non-image logo keeps the previous copy, and other origins are never fetched', async () => {
  const { entries, storage } = cacheStorage({ [logo('old.png')]: png('old') });
  const { requested, request } = recordingFetch(() => new Response('<html>', { headers: { 'content-type': 'text/html' } }));
  await cacheShellBranding({ slots: { sidebarLogoExpanded: '/api/theme/branding/new.png', sidebarLogoCollapsed: 'https://cdn.example/logo.png' } },
    origin, storage, request);
  expect(requested).toEqual([logo('new.png')]);
  expect([...entries.keys()]).toEqual([logo('old.png')]);
});

test('the shell points stored logo slots at local copies and leaves the others', async () => {
  const { storage } = cacheStorage({ [logo('expanded.png')]: png() });
  const branding = await withCachedBranding({ slots: { sidebarLogoExpanded: '/api/theme/branding/expanded.png', sidebarLogoCollapsed: '/api/theme/branding/collapsed.png', authLogo: '/auth.png' } }, origin, storage);
  expect(branding.slots.sidebarLogoExpanded).toStartWith('blob:');
  expect(branding.slots.sidebarLogoCollapsed).toBe('/api/theme/branding/collapsed.png');
  expect(branding.slots.authLogo).toBe('/auth.png');
});
