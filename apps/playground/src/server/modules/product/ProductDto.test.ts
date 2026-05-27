import { describe, expect, test } from 'bun:test';
import { productParam, productUpdateDto, resolveProductParam } from './ProductDto';

describe('Product smart resolver DTOs', () => {
  test('accepts product, id, and name aliases for smart reads/deletes', () => {
    expect(resolveProductParam(productParam.parse({ product: 'Laptop Pro 15' }))).toBe('Laptop Pro 15');
    expect(resolveProductParam(productParam.parse({ id: 'ed052515-e557-4ef2-a3b8-07d24ff74d4b' }))).toBe('ed052515-e557-4ef2-a3b8-07d24ff74d4b');
    expect(resolveProductParam(productParam.parse({ name: 'TempTestProduct_B1_Verify' }))).toBe('TempTestProduct_B1_Verify');
  });

  test('keeps name as an update field while product selects the target', () => {
    const parsed = productUpdateDto.parse({
      product: 'Laptop Pro 15',
      name: 'Laptop Pro 16',
      price: 1499.99,
    });

    expect(resolveProductParam(parsed)).toBe('Laptop Pro 15');
    expect(parsed.name).toBe('Laptop Pro 16');
  });
});
