import { describe, expect, test } from 'bun:test';
import { authIdentityRateLimitKey } from '../src/auth/AuthController';
import {
  createIdentityResolver,
  normalizeAuthIdentifier,
} from '../src/identity/resolver';
import { resolveAuthConfig } from '../src/AuthPlugin';
import { AuthIdentityContextService } from '../src/auth/AuthIdentityContextService';
import {
  EXACT_TEMPORARY_CREDENTIAL_KIND,
  MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND,
  moroccanCinTemporaryCredential,
  resolveTemporaryCredentialKind,
  toTemporaryCredential,
} from '../src/identity/temporaryCredential';

const jwt = { accessSecret: 'a'.repeat(32), refreshSecret: 'b'.repeat(32) };

describe('identity presets', () => {
  test('Morocco is the default preset', () => {
    expect(normalizeAuthIdentifier('0612345678')).toBe('+212612345678');
    expect(normalizeAuthIdentifier('06 12 34 56 78')).toBe('+212612345678');
    expect(normalizeAuthIdentifier('212612345678')).toBe('+212612345678');
    expect(normalizeAuthIdentifier('+212612345678')).toBe('+212612345678');
  });

  test('email identifiers are lowercased and phone junk is rejected', () => {
    expect(normalizeAuthIdentifier('Fatima@Example.MA')).toBe('fatima@example.ma');
    expect(normalizeAuthIdentifier('not-a-number')).toBeNull();
    expect(normalizeAuthIdentifier('   ')).toBeNull();
    expect(normalizeAuthIdentifier(42)).toBeNull();
  });

  test('generic E.164 handling stays the final fallback', () => {
    const resolve = createIdentityResolver();
    expect(resolve('0033612345678')).toBe('+33612345678');
    expect(resolve('+33612345678')).toBe('+33612345678');
  });

  test('custom normalizers extend the preset deterministically', () => {
    const employeeNumber = (value: string) =>
      /^emp-\d{4}$/i.test(value) ? value.toUpperCase() : null;

    const resolve = createIdentityResolver({ extend: [employeeNumber] });
    expect(resolve('emp-0042')).toBe('EMP-0042');
    // The preset still applies to everything the extension declines.
    expect(resolve('0612345678')).toBe('+212612345678');
  });

  test('extensions run before the country preset', () => {
    const claimsLocalNumbers = (value: string) =>
      value.startsWith('06') ? `local:${value}` : null;

    const resolve = createIdentityResolver({ extend: [claimsLocalNumbers] });
    expect(resolve('0612345678')).toBe('local:0612345678');
  });

  test('another country preset replaces Morocco rather than stacking', () => {
    const resolve = createIdentityResolver({ preset: 'tn' });
    expect(resolve('71234567')).toBe('+21671234567');
    expect(resolve('+21671234567')).toBe('+21671234567');
    // A Moroccan local number is no longer claimed by anything.
    expect(resolve('0612345678')).toBeNull();
  });

  test('preset null keeps only generic handling', () => {
    const resolve = createIdentityResolver({ preset: null });
    expect(resolve('0612345678')).toBeNull();
    expect(resolve('+212612345678')).toBe('+212612345678');
    expect(resolve('fatima@example.ma')).toBe('fatima@example.ma');
  });

  test('an unknown preset name fails at configuration time', () => {
    expect(() => createIdentityResolver({ preset: 'zz' as never })).toThrow(/identity preset/);
  });

  test('two resolved auth configurations keep independent country presets', () => {
    const morocco = resolveAuthConfig({ jwt, identity: { preset: 'ma' } });
    const tunisia = resolveAuthConfig({ jwt, identity: { preset: 'tn' } });

    expect(morocco.identity.resolve('0612345678')).toBe('+212612345678');
    expect(tunisia.identity.resolve('0612345678')).toBeNull();
    expect(tunisia.identity.resolve('71234567')).toBe('+21671234567');
    expect(morocco.identity.resolve('71234567')).toBeNull();
  });

  test('two server middleware instances attach their own resolver per request', async () => {
    const middlewareFor = async (preset: 'ma' | 'tn') => {
      let handler: ((context: any, next: () => Promise<void>) => Promise<void>) | undefined;
      const service = new AuthIdentityContextService(
        resolveAuthConfig({ jwt, identity: { preset } }),
      );
      (service as any).container = {
        setInjection: (injection: { handler: typeof handler }) => {
          handler = injection.handler;
        },
      };
      await service.configure();
      return handler!;
    };

    const contextFor = (identifier: string) => {
      const values = new Map<string, unknown>();
      return {
        req: {
          header: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.7' : undefined),
          json: async () => ({ identifier, password: 'x' }),
        },
        set: (key: string, value: unknown) => values.set(key, value),
        get: (key: string) => values.get(key),
      };
    };

    const moroccoContext = contextFor('0612345678');
    const tunisiaContext = contextFor('0612345678');
    await (await middlewareFor('ma'))(moroccoContext, async () => undefined);
    await (await middlewareFor('tn'))(tunisiaContext, async () => undefined);

    expect(await authIdentityRateLimitKey(moroccoContext as never))
      .not.toBe('203.0.113.7');
    expect(await authIdentityRateLimitKey(tunisiaContext as never))
      .toBe('203.0.113.7');
  });
});

describe('rate-limit bucketing uses the resolved identity', () => {
  const contextFor = (identifier: string, resolve = createIdentityResolver()) => ({
    req: {
      header: (name: string) => (name === 'x-forwarded-for' ? '203.0.113.7' : undefined),
      json: async () => ({ identifier, password: 'x' }),
    },
    get: () => resolve,
  }) as never;

  test('local and international forms share one bucket', async () => {
    const local = await authIdentityRateLimitKey(contextFor('0612345678'));
    const international = await authIdentityRateLimitKey(contextFor('+212 612 345 678'));
    expect(local).toBe(international);
    expect(local.startsWith('203.0.113.7:')).toBe(true);
  });

  test('the bucket follows the configured preset', async () => {
    const withMorocco = await authIdentityRateLimitKey(
      contextFor('0612345678', createIdentityResolver({ preset: 'ma' })),
    );
    const withTunisia = await authIdentityRateLimitKey(
      contextFor('0612345678', createIdentityResolver({ preset: 'tn' })),
    );

    // Unresolvable under `tn`, so it degrades to the IP-only bucket.
    expect(withTunisia).toBe('203.0.113.7');
    expect(withMorocco).not.toBe(withTunisia);
  });
});

describe('temporary credential kinds', () => {
  test('exact is the default and is case-sensitive', () => {
    expect(toTemporaryCredential('AB123456')).toEqual({
      kind: EXACT_TEMPORARY_CREDENTIAL_KIND,
      value: 'AB123456',
    });
    const exact = resolveTemporaryCredentialKind();
    expect(exact.normalize('AB123456')).toBe('AB123456');
    expect(exact.isTemporaryShape).toBeUndefined();
  });

  test('ma-cin trims and lowercases a valid CIN only', () => {
    const kind = resolveTemporaryCredentialKind(MOROCCAN_CIN_TEMPORARY_CREDENTIAL_KIND);
    expect(kind.normalize('  AB123456 ')).toBe('ab123456');
    expect(kind.normalize('Fatima2026')).toBe('Fatima2026');
    expect(kind.isTemporaryShape!('ab123456')).toBe(true);
    expect(kind.isTemporaryShape!('fatima2026')).toBe(false);
  });

  test('moroccanCinTemporaryCredential produces the structured input', () => {
    expect(moroccanCinTemporaryCredential('AB123456')).toEqual({
      kind: 'ma-cin',
      value: 'AB123456',
    });
  });

  test('moroccanCinTemporaryCredential refuses to mislabel an invalid value', () => {
    expect(() => moroccanCinTemporaryCredential('not-a-cin')).toThrow(/valid Moroccan CIN/);
  });

  test('an unknown stored kind fails closed instead of falling back', () => {
    expect(() => resolveTemporaryCredentialKind('gone-in-a-downgrade')).toThrow(
      /Unknown temporary credential kind/,
    );
  });
});
