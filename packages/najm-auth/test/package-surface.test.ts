import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = join(import.meta.dir, '..');
const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const read = (relative: string) => readFileSync(join(packageRoot, relative), 'utf8');

describe('published surface', () => {
  test('the identity/ma subpath is exported and built', () => {
    expect(packageJson.exports['./identity/ma']).toEqual({
      types: './dist/identity/ma.d.ts',
      import: './dist/identity/ma.js',
      default: './dist/identity/ma.js',
    });
    expect(read('tsup.config.ts')).toContain("'src/identity/ma.ts'");
  });

  test('only dist is packed, so every export must resolve inside it', () => {
    expect(packageJson.files).toEqual(['dist']);

    for (const [subpath, entry] of Object.entries(packageJson.exports) as [string, any][]) {
      for (const target of Object.values(entry) as string[]) {
        expect(target.startsWith('./dist/')).toBe(true);
        expect(
          existsSync(join(packageRoot, target)),
          `${subpath} → ${target} is missing; run "bun run build:auth" first`,
        ).toBe(true);
      }
    }
  });

  test('the new contracts appear in the built declarations', () => {
    const maTypes = read('dist/identity/ma.d.ts');
    expect(maTypes).toContain('moroccanCinTemporaryCredential');
    expect(maTypes).toContain('moroccoIdentityPreset');

    const rootTypes = read('dist/index.d.ts');
    for (const name of [
      'credentialSetupRequirementsTable',
      'CredentialSetupRequirementService',
      'PasswordSetupService',
      'PASSWORD_SETUP_PURPOSE',
      'CREDENTIAL_SETUP_CODES',
      'LoginResult',
      'IdentityConfig',
    ]) {
      expect(rootTypes).toContain(name);
    }

    for (const dialect of ['pg', 'sqlite'] as const) {
      expect(read(`dist/schema/${dialect}.d.ts`)).toContain('credentialSetupRequirementsTable');
    }
  });

  test('the client entry exposes the discriminated login result', () => {
    const clientTypes = read('dist/client/index.d.ts');
    expect(clientTypes).toContain('LoginResult');
    expect(clientTypes).toContain('CredentialSetupPending');
  });

  test('the server entry exposes the composed Next.js auth surface', () => {
    const serverTypes = read('dist/client/server/index.d.ts');
    for (const name of [
      'ProxySessionMode',
      'proxySessionMode',
      'routeHandlers',
      'NextAuthRouteHandlers',
    ]) {
      expect(serverTypes).toContain(name);
    }
  });
});

describe('the React-server session adapter', () => {
  const otherEntries = [
    'dist/index',
    'dist/client/index',
    'dist/client/edge',
    'dist/client/react/index',
    'dist/client/server/index',
  ];

  test('it is exported as its own opt-in subpath', () => {
    expect(packageJson.exports['./client/server/react']).toEqual({
      types: './dist/client/server/react.d.ts',
      'react-server': './dist/client/server/react.js',
      browser: './dist/client/server/reactClientGuard.js',
      import: './dist/client/server/react.js',
      default: './dist/client/server/react.js',
    });
    expect(read('tsup.config.ts')).toContain("'src/client/server/react.ts'");
    expect(read('tsup.config.ts')).toContain("'src/client/server/reactClientGuard.ts'");
  });

  test('the declarations carry the documented contract', () => {
    const types = read('dist/client/server/react.d.ts');
    for (const name of [
      'createReactServerAuth',
      'ReactServerAuth',
      'getSession(): Promise<ServerSession | null>',
      'requireSession(): Promise<ServerSession>',
      'requireRole(roles: string[]): Promise<ServerSession>',
    ]) {
      expect(types).toContain(name);
    }
  });

  test('no other entry point re-exports it', () => {
    for (const entry of otherEntries) {
      expect(read(`${entry}.js`)).not.toContain('createReactServerAuth');
      expect(read(`${entry}.d.ts`)).not.toContain('createReactServerAuth');
    }
  });

  test('the Edge and proxy outputs stay free of React', () => {
    for (const entry of ['dist/client/edge.js', 'dist/client/server/index.js']) {
      const source = read(entry);
      expect(source).not.toMatch(/from\s*["']react["']/);
      expect(source).not.toMatch(/import\(\s*["']react["']\s*\)/);
      expect(source).not.toContain('client/server/react');
    }
  });

  test('it is a server module, while client/react stays a client boundary', () => {
    expect(read('dist/client/server/react.js')).not.toContain('use client');
    expect(read('dist/client/react/index.js')).toStartWith('"use client"');
  });

  test('the browser condition resolves to a module that refuses to load', async () => {
    const guard = pathToFileURL(join(packageRoot, 'dist/client/server/reactClientGuard.js')).href;
    await expect(import(guard)).rejects.toThrow(/React Server Component module/);
  });
});
