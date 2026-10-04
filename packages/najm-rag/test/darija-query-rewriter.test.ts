import { describe, expect, test } from 'bun:test';
import { createDarijaQueryRewriter } from '../src/queryRewrites';
import { normalizeQuery, rewriteRoutingQuery } from '../src/toolRouter/ToolRouterUtils';

describe('opt-in Darija routing rewriter', () => {
  const rewrite = createDarijaQueryRewriter();

  test.each([
    ['شحال من طلب عندنا؟', 'كم عدد طلب عندنا؟'],
    ['وشْحال من منتج كاين؟', 'وكم عدد منتج يوجد؟'],
    ['فين هاد الطلب ديالي؟', 'اين هذا الطلب ؟'],
    ['وريني الطلبات ديال البارح', 'اعرض الطلبات امس'],
    ['بغيت نعرف شنو كاين فالخزينه', 'اريد نعرف ما يوجد في الخزينه'],
  ])('rewrites common wording independently of an app: %s', (query, expected) => {
    expect(rewrite(normalizeQuery(query))).toBe(expected);
  });

  test('keeps school and financial interpretations out of the shared preset', () => {
    expect(rewrite('علم النقط فرض ما خلصوش')).toBe('علم النقط فرض ما خلصوش');
    expect(rewrite('الرقم ديال الطلب')).toBe('الرقم الطلب');
  });

  test('extends vocabulary and joins only known negation forms', () => {
    const orders = createDarijaQueryRewriter({ words: { ماخلصوش: 'لم يدفعوا' } });
    expect(orders('شكون ما خْلصوش؟')).toBe('من لم يدفعوا؟');
    expect(orders('شكون ما عرفتش؟')).toBe('من ما عرفتش؟');
    expect(rewrite('شكون ما خلصوش؟')).toBe('من ما خلصوش؟');
  });

  test('preserves meaningful shadda for app overrides under conjunctions', () => {
    const rewrite = createDarijaQueryRewriter({ words: { 'علّم': 'ميّز' } });
    expect(rewrite('وَعَلِّمْ العنصر')).toBe('وميّز العنصر');
    expect(rewrite('علم وعِلْمُ الاحياء يَاسِين')).toBe('علم وعِلْمُ الاحياء يَاسِين');
  });

  test('supports overrides, disabled words and immutable configuration snapshots', () => {
    const words = { وريني: 'ابحث', ديال: null };
    const rewrite = createDarijaQueryRewriter({ words });
    words.وريني = 'تغير';
    expect(rewrite('وريني ديال الطلب')).toBe('ابحث ديال الطلب');
    expect(createDarijaQueryRewriter()('وريني ديال الطلب')).toBe('اعرض الطلب');
  });

  test('app rewrite rules are literal, vowel-aware and preserve conjunctions', () => {
    const rules = [{ from: 'الرقم ديال', to: 'معرف الطلب' }];
    const rewrite = createDarijaQueryRewriter({ rewriteRules: rules });
    rules[0].to = 'تغير';
    expect(rewrite('وَالرقم دِيال الطلب')).toBe('ومعرف الطلب الطلب');
    expect(createDarijaQueryRewriter({ rewriteRules: [{ from: 'بغيت نعرف', to: '$&' }] })('بغيت نعرف')).toBe('$&');
  });

  test('matches whole words and prevents app replacement rules leaking across instances', () => {
    const phone = createDarijaQueryRewriter({ rewriteRules: [{ from: 'الرقم ديال', to: 'رقم هاتف' }] });
    expect(phone('وريني الرقم ديال العميل')).toBe('اعرض رقم هاتف العميل');
    expect(rewrite('وريني الرقم ديال العميل')).toBe('اعرض الرقم العميل');
    expect(phone('الرقم ديالك')).toBe('الرقم');
  });

  test('leaves other languages, names and codes as the router supplied them', () => {
    for (const query of ['Show order ABC123', 'Montre les commandes', 'Muestra los pedidos',
      'نقاط مادة علم الاحياء', 'يَاسِين وعلم الاحياء']) {
      expect(rewrite(query)).toBe(query);
    }
  });

  test('the existing routing hook remains opt-in and retains empty-result fallback', () => {
    const query = normalizeQuery('شحال من طلب؟');
    expect(rewriteRoutingQuery(query)).toBe(query);
    expect(rewriteRoutingQuery(query, rewrite)).toBe('كم عدد طلب؟');
    expect(rewriteRoutingQuery('ديال', rewrite)).toBe('ديال');
  });

  test('rejects regular expressions and non-word overrides during configuration', () => {
    expect(() => createDarijaQueryRewriter({ rewriteRules: [{ from: '.*', to: 'x' }] })).toThrow(TypeError);
    expect(() => createDarijaQueryRewriter({ rewriteRules: [{ from: '', to: 'x' }] })).toThrow(TypeError);
    expect(() => createDarijaQueryRewriter({ words: { 'شحال من': 'x' } })).toThrow(TypeError);
  });

  test('handles long conjunctions without recursive work', () => {
    const prefix = 'و'.repeat(12000);
    expect(rewrite(`${prefix}شحال`)).toBe(`${prefix}كم`);
    expect(rewrite(`${prefix}وقت`)).toBe(`${prefix}وقت`);
  });
});
