import { expect, test } from 'bun:test';
import { Server } from '../src/index';

test('re-exports the core Server API', () => {
  expect(typeof Server).toBe('function');
});
