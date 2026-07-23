import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { resolveRegisteredToolInputSchema } from 'najm-mcp';

// Reproduce the private helper inline to test it directly
function resolveSchemaTypeName(schema: any): string {
  if (!schema || typeof schema !== 'object') return 'unknown';

  const def = schema._zod?.def ?? schema._def;
  if (def) {
    const type = def.type;
    if (
      type === 'optional' ||
      type === 'default' ||
      type === 'exact_optional' ||
      type === 'nullable' ||
      type === 'nullish' ||
      type === 'catch' ||
      type === 'readonly' ||
      type === 'nonoptional'
    ) {
      return resolveSchemaTypeName(def.innerType);
    }
    if (typeof type === 'string') return type;
  }

  if (typeof schema._def?.typeName === 'string') {
    const typeName = schema._def.typeName;
    if (
      typeName === 'ZodOptional' ||
      typeName === 'ZodDefault' ||
      typeName === 'ZodNullable' ||
      typeName === 'ZodNullish' ||
      typeName === 'ZodCatch'
    ) {
      return resolveSchemaTypeName(schema._def.innerType);
    }
    return typeName.replace(/^Zod/, '').toLowerCase();
  }

  if (typeof schema.type === 'string') return schema.type;

  return 'unknown';
}

describe('ToolMetadataService type resolution', () => {
  test('unwraps optional and default wrappers to show inner type', () => {
    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
      price: z.number(),
      stock: z.number().default(0),
      category: z.string(),
      imageUrl: z.string().optional(),
    });

    const shape = resolveRegisteredToolInputSchema({ validation: { body: schema } }) ?? {};
    const params = Object.entries(shape).map(([name, s]) => ({
      name,
      type: resolveSchemaTypeName(s),
      required: !(s as any)?.isOptional?.(),
    }));

    expect(params).toEqual([
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'price', type: 'number', required: true },
      { name: 'stock', type: 'number', required: false },
      { name: 'category', type: 'string', required: true },
      { name: 'imageUrl', type: 'string', required: false },
    ]);
  });

  test('unwraps nested wrappers like nullable and catch', () => {
    const schema = z.object({
      tag: z.string().nullable(),
      count: z.number().catch(0),
    });

    const shape = resolveRegisteredToolInputSchema({ validation: { body: schema } }) ?? {};
    const params = Object.entries(shape).map(([name, s]) => ({
      name,
      type: resolveSchemaTypeName(s),
      required: !(s as any)?.isOptional?.(),
    }));

    expect(params).toEqual([
      { name: 'tag', type: 'string', required: true },
      { name: 'count', type: 'number', required: false },
    ]);
  });
});
