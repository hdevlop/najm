import 'reflect-metadata';
import { beforeAll, describe, expect, mock, test } from 'bun:test';

const decorator = () => (...args: any[]) => args[0];

mock.module('najm-api', () => ({
  Service: decorator,
  Repository: decorator,
  Err: (status: number, message: string) => {
    const error = new Error(message);
    (error as any).status = status;
    throw error;
  },
  resolveBy: async () => ({ kind: 'not_found' }),
  normalizeResolutionQuery: (value: string) => value.trim(),
  escapeLike: (value: string) => value.replace(/[\\%_]/g, '\\$&'),
}));

mock.module('najm-event', () => ({
  Events: decorator,
}));

mock.module('najm-database', () => ({
  DB: decorator,
}));

mock.module('najm-i18n', () => ({
  I18n: decorator,
}));

let ProductService: typeof import('./ProductService').ProductService;

beforeAll(async () => {
  ({ ProductService } = await import('./ProductService'));
});

function createServiceWithThrowingResolver() {
  const error = new Error('Multiple products match');
  const calls = {
    requireProduct: 0,
    update: 0,
    delete: 0,
  };

  const repository = {
    update() {
      calls.update += 1;
      throw new Error('update should not be called');
    },
    delete() {
      calls.delete += 1;
      throw new Error('delete should not be called');
    },
  };

  const validator = {
    async requireProduct() {
      calls.requireProduct += 1;
      throw error;
    },
  };

  return {
    calls,
    error,
    service: new ProductService(repository as any, validator as any),
  };
}

describe('ProductService smart writes', () => {
  test('update stops before mutation when smart resolver rejects ambiguity', async () => {
    const { calls, error, service } = createServiceWithThrowingResolver();

    await expect(service.update('phone', { price: 42 })).rejects.toBe(error);

    expect(calls.requireProduct).toBe(1);
    expect(calls.update).toBe(0);
  });

  test('delete stops before mutation when smart resolver rejects ambiguity', async () => {
    const { calls, error, service } = createServiceWithThrowingResolver();

    await expect(service.delete('phone')).rejects.toBe(error);

    expect(calls.requireProduct).toBe(1);
    expect(calls.delete).toBe(0);
  });
});
