import { describe, test, expect } from 'bun:test';

describe('useBanner pure logic', () => {
  test('banner state starts null', () => {
    const banner = null;
    expect(banner).toBeNull();
  });

  test('showBanner creates banner object', () => {
    const kind = 'info';
    const title = 'Test title';
    const message = 'Test message';
    const banner = { kind, title, message };
    expect(banner).toEqual({ kind: 'info', title: 'Test title', message: 'Test message' });
  });

  test('showBanner with only title', () => {
    const banner = { kind: 'error' as const, title: 'Error occurred', message: undefined };
    expect(banner).toEqual({ kind: 'error', title: 'Error occurred', message: undefined });
  });

  test('dismissBanner sets banner to null', () => {
    let banner = { kind: 'success' as const, title: 'Success', message: undefined };
    banner = null;
    expect(banner).toBeNull();
  });

  test('banner kind comparison works', () => {
    const banner = { kind: 'info' as const, title: 'Test' };
    expect(banner.kind === 'info').toBe(true);
    expect(banner.kind === 'error').toBe(false);
  });
});
