import { expect, test } from 'bun:test';
import {
  Server,
  guards,
  Validate,
  database,
  auth,
  mcp,
  Cookie,
} from '../src/index';
import { createGuard } from '../src/guard';
import { authSchema } from '../src/auth';
import { rateLimit } from '../src/rate';

test('re-exports the core Server API', () => {
  expect(typeof Server).toBe('function');
});

test('re-exports common plugin APIs from the root entry', () => {
  expect(typeof guards).toBe('function');
  expect(typeof Validate).toBe('function');
  expect(typeof database).toBe('function');
  expect(typeof auth).toBe('function');
  expect(typeof mcp).toBe('function');
  expect(typeof Cookie).toBe('function');
});

test('exposes feature subpath entries', () => {
  expect(typeof createGuard).toBe('function');
  expect(typeof rateLimit).toBe('function');
  expect(typeof authSchema).toBe('object');
});
