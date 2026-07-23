import { describe, test, expect } from 'bun:test';
import { normalizeQuery, normalizeArabic } from '../src/toolRouter/ToolRouterUtils';

describe('textUtils', () => {
  test('normalizeArabic replaces Arabic variants', () => {
    expect(normalizeArabic('أإآ')).toBe('ااا');
    expect(normalizeArabic('ى')).toBe('ي');
    expect(normalizeArabic('ة')).toBe('ه');
  });

  test('normalizeQuery trims and lowercases', () => {
    expect(normalizeQuery('  Hello World  ')).toBe('hello world');
  });

  test('normalizeQuery applies Arabic normalization', () => {
    expect(normalizeQuery('حذف')).toBe('حذف');
    expect(normalizeQuery('مسح')).toBe('مسح');
    expect(normalizeQuery('أحمد')).toBe('احمد');
  });
});
