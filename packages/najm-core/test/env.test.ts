import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { envChoice, envFlag, envInt, envString, isProduction, requireEnv } from '../dist/env.mjs';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('najm-core/env', () => {
  test('the built entrypoint imports nothing and is exported with types', () => {
    const built = readFileSync(resolve(import.meta.dir, '../dist/env.mjs'), 'utf8');
    expect(built).not.toMatch(/\bimport\b|\brequire\(/);

    const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, '../package.json'), 'utf8'));
    expect(manifest.exports['./env']).toEqual({
      types: './dist/env.d.ts',
      import: './dist/env.mjs',
      default: './dist/env.mjs',
    });
    expect(Object.keys(manifest.exports).indexOf('./env'))
      .toBeLessThan(Object.keys(manifest.exports).indexOf('./*'));
    expect(readFileSync(resolve(import.meta.dir, '../dist/env.d.ts'), 'utf8')).toContain('envChoice');
  });

  test('blank and unset are the same', () => {
    expect(envString(undefined)).toBeUndefined();
    expect(envString('')).toBeUndefined();
    expect(envString('   ')).toBeUndefined();
    expect(envString('  value ')).toBe('value');

    expect(envInt('N', '  ', { fallback: 7 })).toBe(7);
    expect(envChoice('C', '', ['a', 'b'], 'b')).toBe('b');
    expect(envFlag('')).toBe(false);
  });

  test('requireEnv names the variable and the reason', () => {
    expect(requireEnv('API_KEY', ' k ', 'for resend')).toBe('k');
    expect(() => requireEnv('API_KEY', ' ', 'when EMAIL_PROVIDER is resend'))
      .toThrow('API_KEY is required when EMAIL_PROVIDER is resend.');
  });

  test('envFlag accepts only 1 and true, in any case', () => {
    for (const on of ['1', 'true', 'TRUE', ' True ']) expect(envFlag(on)).toBe(true);
    for (const off of [undefined, '0', 'false', 'yes', 'on', '2']) expect(envFlag(off)).toBe(false);
  });

  test('envInt parses decimal integers within bounds', () => {
    expect(envInt('PORT', '587', { fallback: 0, min: 1, max: 65535 })).toBe(587);
    expect(envInt('HOPS', '0', { fallback: 1, max: 8 })).toBe(0);
    expect(envInt('HOPS', ' 8 ', { fallback: 1, max: 8 })).toBe(8);
  });

  test('envInt rejects malformed and out-of-range values with the name and range', () => {
    const port = { fallback: 0, min: 1, max: 65535 };
    for (const bad of ['abc', '1.5', '-1', '1e3', '0x10', '+3', '65536', '0']) {
      expect(() => envInt('SMTP_PORT', bad, port)).toThrow('SMTP_PORT must be an integer from 1 to 65535.');
    }
    expect(() => envInt('RETRIES', 'x', { fallback: 1 })).toThrow('RETRIES must be an integer 0 or more.');
    expect(() => envInt('RETRIES', '9007199254740993', { fallback: 1 }))
      .toThrow('RETRIES must be an integer 0 or more.');
  });

  test('envChoice lower-cases the value and lists the choices on error', () => {
    expect(envChoice('EMAIL_PROVIDER', ' SMTP ', ['console', 'smtp'], 'console')).toBe('smtp');
    expect(() => envChoice('EMAIL_PROVIDER', 'Mailgun', ['console', 'smtp'], 'console'))
      .toThrow("EMAIL_PROVIDER must be one of: console, smtp. Got 'mailgun'.");
  });

  test('isProduction reads NODE_ENV at call time', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
    process.env.NODE_ENV = 'development';
    expect(isProduction()).toBe(false);
  });
});
