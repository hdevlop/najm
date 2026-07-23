import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { getSchemaShape } from '../src/schemaUtils';

describe('getSchemaShape', () => {
  test('unwraps refined object schemas', () => {
    const schema = z.object({
      amount: z.number(),
      currency: z.string().default('USD'),
    }).superRefine(() => {});

    const shape = getSchemaShape(schema);

    expect(Object.keys(shape ?? {})).toEqual(['amount', 'currency']);
  });
});
