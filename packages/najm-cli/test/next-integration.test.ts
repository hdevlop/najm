import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import {
  applyNextIntegrationPlan,
  createNextIntegrationPlan,
  NAJM_NEXT_INTEGRATION_VERSIONS,
  previewNextIntegrationPlan,
  PROTECTED_LAYOUT_TEMPLATE,
} from '../src/nextIntegration';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), 'najm-cli-next-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('Najm Next integration scaffolding', () => {
  test('minimal mode has no Auth, Theme, Kit, Query, Leaflet, or Google dependency', () => {
    const plan = createNextIntegrationPlan({
      appId: 'minimal-app',
      auth: false,
      theme: false,
      location: 'disabled',
    });
    expect(plan.dependencies).toContain(`najm-next@${NAJM_NEXT_INTEGRATION_VERSIONS.next}`);
    expect(plan.dependencies.join(' ')).not.toMatch(/najm-auth|najm-kit|najm-theme|tanstack|leaflet|googlemaps/);
    expect(plan.files.find((file) => file.path === 'src/providers.tsx')?.content).toContain('providers = {  }');
  });

  test('Kafil-style and School-style choices use optional leaf dependencies', () => {
    const leaflet = createNextIntegrationPlan({
      appId: 'leaflet-app', auth: true, theme: true, location: 'leaflet',
    });
    const google = createNextIntegrationPlan({
      appId: 'google-app', auth: true, theme: true, location: 'google',
    });
    expect(leaflet.dependencies).toContain('leaflet@1.9.4');
    expect(leaflet.dependencies.join(' ')).not.toContain('googlemaps');
    expect(google.dependencies).toContain('@googlemaps/js-api-loader@2.1.1');
    expect(google.dependencies.join(' ')).not.toContain('leaflet@');
    expect(google.files.find((file) => file.path === 'src/najm.config.ts')?.content)
      .toContain("allowedProviders: ['google']");
    const providers = leaflet.files.find((file) => file.path === 'src/providers.tsx')!.content;
    expect(providers).toContain("from 'najm-next/app/client'");
    expect(providers).toContain("import { NajmAppProvider } from 'najm-next/app/client'");
    expect(providers).toContain('<NajmAppProvider');
    expect(providers).toContain('authClient={auth.client}');
    expect(providers).toContain('snapshot={snapshot}');
    expect(providers).not.toContain('query={true}');
    expect(providers).not.toContain('appName=');
    expect(providers).not.toContain('NajmNextAppProvider');
    expect(providers).not.toContain('bindNajmNextProvider');
    expect(providers).not.toContain('createNajmAppProvider');
    expect(providers).not.toContain('initialDesign={');
    expect(providers).not.toContain('initialLanguage={');
    expect(providers).not.toContain('initialTheme={');
    expect(providers).not.toContain('initialTimeZone={');
    expect(leaflet.files.find((file) => file.path === 'src/najm.config.ts')?.content)
      .toContain("appName: 'Leaflet App'");
  });

  test('keeps matcher literals and server/client boundaries explicit', () => {
    const plan = createNextIntegrationPlan({
      appId: 'bounded-app', auth: true, theme: true, location: 'google',
    });
    const proxy = plan.files.find((file) => file.path === 'src/proxy.ts')!.content;
    const server = plan.files.find((file) => file.path === 'src/najm.server.ts')!.content;
    const providers = plan.files.find((file) => file.path === 'src/providers.tsx')!.content;
    expect(proxy).toContain('export const config = {');
    expect(proxy).toContain('matcher: [');
    expect(server).toStartWith("import 'server-only';");
    expect(providers).toStartWith("'use client';");
    expect(providers).not.toContain("from '@/najm.server'");
    expect(PROTECTED_LAYOUT_TEMPLATE).toContain("from '@/najm.server'");
    expect(PROTECTED_LAYOUT_TEMPLATE).toContain('await requireSession()');
    expect(PROTECTED_LAYOUT_TEMPLATE).not.toContain('catch(() => null)');
  });

  test('previews, applies, and reruns without rewriting files', async () => {
    const root = await temporaryDirectory();
    const plan = createNextIntegrationPlan({
      appId: 'rerun-app', auth: true, theme: true, location: 'leaflet',
    });
    expect((await previewNextIntegrationPlan(root, plan)).every((entry) => entry.status === 'create')).toBe(true);
    await applyNextIntegrationPlan(root, plan);
    expect((await previewNextIntegrationPlan(root, plan)).every((entry) => entry.status === 'unchanged')).toBe(true);
    expect(await readFile(path.join(root, 'src/najm.config.ts'), 'utf8')).toBe(
      plan.files.find((file) => file.path === 'src/najm.config.ts')!.content,
    );
  });

  test('refuses all writes when any target conflicts', async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, 'src/app'), { recursive: true });
    await writeFile(path.join(root, 'src/app/layout.tsx'), '// user-owned\n');
    const plan = createNextIntegrationPlan({
      appId: 'safe-app', auth: false, theme: false, location: 'disabled',
    });
    await expect(applyNextIntegrationPlan(root, plan)).rejects.toThrow('Refusing to overwrite');
    expect(await readFile(path.join(root, 'src/app/layout.tsx'), 'utf8')).toBe('// user-owned\n');
    await expect(readFile(path.join(root, 'src/najm.config.ts'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('rejects path traversal and invalid app identifiers', () => {
    expect(() => createNextIntegrationPlan({
      appId: 'Bad App', auth: false, theme: false, location: 'disabled',
    })).toThrow('appId');
    expect(() => createNextIntegrationPlan({
      appId: 'safe-app', basePath: '../server', auth: false, theme: false, location: 'disabled',
    })).toThrow('basePath');
  });
});
