import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
});
