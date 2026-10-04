import { describe, expect, test } from 'bun:test';
import { createDarijaQueryRewriter } from '../src/queryRewrites';

describe('published Darija query rewrite compatibility', () => {
  test.each([
    ['شحال من تلميذ كاين فالمدرسة', 'كم عدد تلميذ يوجد في المدرسه'],
    ['فين كاينين التلاميذ', 'اين يوجد التلاميذ'],
    ['ما كاينش', 'لا يوجد'],
    ['وشحال من تلميذ', 'وكم عدد تلميذ'],
    ['English وStudent', 'English وStudent'],
    ['شنو بغيت دابا', 'ما اريد الان'],
  ])('preserves the published result for %s', (input, output) => {
    expect(createDarijaQueryRewriter()(input)).toBe(output);
  });

  test('keeps application word overrides and disabled preset words', () => {
    const rewrite = createDarijaQueryRewriter({ words: { شحال: 'عدد', فين: null } });
    expect(rewrite('شحال فين')).toBe('عدد فين');
  });

  test('applies literal application phrase rules before rewriting words', () => {
    const rewrite = createDarijaQueryRewriter({ rewriteRules: [{ from: 'بغيت التلاميذ', to: 'اعرض الطلاب' }] });
    expect(rewrite('بغيت التلاميذ')).toBe('اعرض الطلاب');
  });

  test('rejects nonliteral rules instead of accepting arbitrary regular expressions', () => {
    expect(() => createDarijaQueryRewriter({ rewriteRules: [{ from: '.*', to: 'replace' }] })).toThrow(TypeError);
    expect(() => createDarijaQueryRewriter({ words: { 'not Arabic': 'replace' } })).toThrow(TypeError);
  });
});
