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
    ['بغيت نعرف شنو كاين فالخزينه', 'اريد اعرف ما يوجد في الخزينه'],
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
    // A letter repeated three or more times collapses first (DR2), so a run
    // of thousands of conjunctions costs one linear pass.
    const prefix = 'و'.repeat(12000);
    const start = performance.now();
    expect(rewrite(`${prefix}شحال`)).toBe('وكم');
    expect(rewrite(`${prefix}وقت`)).toBe('وقت');
    expect(rewrite(`وو${'شحال '.repeat(4000)}`.trim())).toStartWith('ووكم كم');
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('DR2 and DR4: cleanup, negation and verb prefixes', () => {
  const rewrite = createDarijaQueryRewriter();

  test('tatweel, stretched letters and Arabic-Indic digits rewrite like the plain form', () => {
    expect(rewrite('وريـــني المنتوجات')).toBe(rewrite('وريني المنتوجات'));
    expect(rewrite('شنو كااااين فالسلة')).toBe(rewrite('شنو كاين فالسلة'));
    expect(rewrite('الطلب رقم ١٢٣')).toBe('الطلب رقم 123');
  });

  test('a joined ما…ش negation becomes لم plus the stem', () => {
    expect(rewrite('ماعرفتش')).toBe('لم عرفت');
    expect(rewrite('مازال ماشريتش')).toBe('ما زال لم شريت');
  });

  test('a negation the word list knows keeps its entry', () => {
    expect(rewrite('ماكاينش')).toBe('لا يوجد');
    const app = createDarijaQueryRewriter({ words: { ماخلصوش: 'لم يدفعوا' } });
    expect(app('ماخلصوش')).toBe('لم يدفعوا');
  });

  test('verb prefixes are stripped before known stems only', () => {
    expect(rewrite('كنقلب على منتوج')).toBe('ابحث على منتوج');
    expect(rewrite('غادي نزيد')).toBe('سوف اضف');
    expect(rewrite('كيحيد')).toBe('ازل');
  });

  test('the bare first-person prefix is stripped before the same stems', () => {
    expect(rewrite('ابغيت نزيد منتوج')).toBe('اريد اضف منتوج');
    expect(rewrite('بغيت نعرف')).toBe('اريد اعرف');
    // Forms the word list has keep their entry.
    expect(rewrite('بغيت نشوف السله')).toBe('اريد انظر السله');
    expect(rewrite('نخرج')).toBe('اخرج');
  });

  test('an object pronoun attached to an imperative is dropped', () => {
    expect(rewrite('زيدلي هادا')).toBe('اضف هذا');
    expect(rewrite('حطها فالسله')).toBe('ضع في السله');
    expect(rewrite('حيدهم')).toBe('ازل');
    expect(rewrite('زيدها')).toBe('اضفها');
  });

  test('words that only look like a prefixed verb are unchanged', () => {
    for (const word of ['كتاب', 'كتب', 'غياب', 'غير', 'كريم', 'كمال', 'غزلان', 'كتبت', 'نسيم', 'حطاب', 'عطية', 'نزيه']) {
      expect(rewrite(word)).toBe(word);
    }
  });

  test('app rules match the wording as typed, before prefixes and negation are rewritten', () => {
    const app = createDarijaQueryRewriter({ rewriteRules: [
      { from: 'كنقلب على', to: 'ابحث عن' },
      { from: 'ماخلصتش', to: 'لم ادفع' },
    ] });
    expect(app(normalizeQuery('كنقلب على منتوج'))).toBe('ابحث عن منتوج');
    expect(app('ماخلصتش')).toBe('لم ادفع');
  });

  test('everyday verbs rewrite; payment and shop words are left to the app', () => {
    expect(rewrite('حيد هادا من السلة')).toBe('ازل هذا من السلة');
    expect(rewrite('خوي السلة')).toBe('افرغ السلة');
    expect(rewrite('خلص الكوموند')).toBe('خلص الكوموند');
    expect(rewrite('علم النقط فرض ما خلصوش')).toBe('علم النقط فرض ما خلصوش');
  });
});

describe('DR3: app-supplied Latin-script (Arabizi) words', () => {
  test('a Latin key rewrites whole tokens only', () => {
    const rewrite = createDarijaQueryRewriter({ words: { ch7al: 'كم', dyal: '', bghit: 'اريد' } });
    expect(rewrite(normalizeQuery('Ch7al dyal tlamid kaynin'))).toBe('كم tlamid kaynin');
    expect(rewrite(normalizeQuery('bghit nchouf'))).toBe('اريد nchouf');
    // Part of a longer token is not a match.
    expect(rewrite(normalizeQuery('ch7alx dyalna'))).toBe('ch7alx dyalna');
  });

  test('no Latin word is rewritten unless the app configures it', () => {
    const rewrite = createDarijaQueryRewriter();
    for (const query of ['ch7al dyal tlamid', 'la fin du mois', 'dial the number']) {
      expect(rewrite(query)).toBe(query);
    }
  });

  test('Latin and Arabic words mix in one message', () => {
    const rewrite = createDarijaQueryRewriter({ words: { ch7al: 'كم' } });
    expect(rewrite(normalizeQuery('ch7al ديال الطلبات'))).toBe('كم الطلبات');
  });

  test('a Latin key must be one token of letters, digits or apostrophes', () => {
    expect(() => createDarijaQueryRewriter({ words: { 'ch7al men': 'x' } })).toThrow(TypeError);
    expect(() => createDarijaQueryRewriter({ words: { 'a.*': 'x' } })).toThrow(TypeError);
  });
});
