import type { RoutingQueryRewrite } from '../config';

/** Literal text substitutions before routing, distinct from tool-linked semantic phrases. */
export interface DarijaRewriteRule {
  from: string;
  to: string;
}

export interface DarijaQueryRewriteOptions {
  /** App vocabulary overrides the preset. Use null to disable a preset word. */
  words?: Readonly<Record<string, string | null>>;
  /** Literal Arabic word sequences, applied in order before word rewriting. */
  rewriteRules?: readonly DarijaRewriteRule[];
}

const DIACRITICS = /[ً-ْ]/g;
const VOWELS = /[ً-ِْ]/g;
const ARABIC_WORD = /[ء-يً-ْ]+/g;
const ARABIC_KEY = /^[ء-يً-ْ]+$/;
/** Arabizi writes some Arabic letters as digits (3, 7, 9), so tokens include digits. */
const LATIN_KEY = /^[a-z0-9']+$/;
const LATIN_WORD = /[A-Za-z0-9']+/g;
const fold = (text: string) => text.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const keyOf = (text: string) => fold(text).replace(VOWELS, '');
const vowelledWord = (word: string) => [...word].join('[ً-ِْ]*') + '[ً-ِْ]*';
const START = '(^|[^ء-يً-ْ])';
const END = '(?=$|[^ء-يً-ْ])';

// Common questions, requests and time expressions only. Apps supply domain
// interpretations (e.g. grades, attendance, payments or invoice numbers).
const WORDS: Readonly<Record<string, string>> = {
  شحال: 'كم', قداش: 'كم', شنو: 'ما', شنوا: 'ما', اشنو: 'ما', شكون: 'من',
  هوما: 'هم', واش: 'هل', فين: 'اين', فاين: 'اين', امتي: 'متى', فوقاش: 'متى',
  علاش: 'لماذا', كيفاش: 'كيف',
  وريني: 'اعرض', وريلي: 'اعرض', ورينا: 'اعرض', عطيني: 'اعرض', جيب: 'اعرض',
  قلب: 'ابحث', لقي: 'جد', بغيت: 'اريد', بغينا: 'نريد', خصني: 'احتاج',
  دير: 'انشئ', ديري: 'انشئ', صيفط: 'ارسل', ليا: 'لي', ليه: 'له', ليها: 'لها', ليهم: 'لهم',
  كاين: 'يوجد', كاينين: 'يوجد', كاينه: 'توجد', كاينش: 'لا يوجد',
  ماكاينش: 'لا يوجد', كاينينش: 'لا يوجد', هاد: 'هذا', هاذ: 'هذا', هادا: 'هذا',
  هادي: 'هذه', هاذي: 'هذه', داك: 'ذلك', ديك: 'تلك',
  ديال: '', ديالو: '', ديالها: '', ديالهم: '', ديالي: '', ديالنا: '', ديالك: '',
  بلي: 'ان', اللي: 'الذي', بزاف: 'كثير', مازال: 'ما زال', مزال: 'ما زال',
  غادي: 'سوف', تسد: 'تغلق', بكري: 'مبكرا', تقدر: 'تستطيع',
  دابا: 'الان', البارح: 'امس', نهار: 'يوم', السيمانه: 'الاسبوع', سيمانه: 'اسبوع',
  العشيه: 'المساء', جاي: 'القادم', الجاي: 'القادم', جايه: 'القادمه',
  الجايه: 'القادمه', جايين: 'القادمه',
  // Everyday verbs, quantities and courtesy words. Payments, prices and shop
  // nouns (خلص, شري, الثمن, الكوموند...) stay out: apps add them through `words`.
  حيد: 'ازل', حيدو: 'ازله', حيدها: 'ازلها', زيد: 'اضف', زيدها: 'اضفها', زيدو: 'اضفه', مسح: 'احذف', نمسح: 'احذف',
  خوي: 'افرغ', فرغ: 'افرغ', بدل: 'غير', نبدل: 'اغير', نقص: 'خفض', حط: 'ضع',
  سد: 'اغلق', دخلني: 'ادخلني', خرجني: 'اخرجني', نخرج: 'اخرج', نتسجل: 'اسجل',
  كلشي: 'كل شيء', كولشي: 'كل شيء', كامل: 'كل', كاملين: 'كل', شي: 'بعض', ماشي: 'ليس', صافي: 'حسنا', عافاك: 'من فضلك',
  لقا: 'جد', شوف: 'انظر', نشوف: 'انظر', نتفرج: 'اشاهد', عندي: 'لدي', عندكم: 'لديكم', واه: 'نعم', جوج: 'اثنان',
  تلاته: 'ثلاثه', حاجه: 'شيء', نمره: 'رقم', سميه: 'اسم', السميه: 'الاسم', سميتو: 'اسمه',
  // نشوف was 'ارى', which the ى→ي fold turns into اري ("show me").
  ابغيت: 'اريد', بغيتي: 'تريد', نبغي: 'اريد', كنبغي: 'اريد', بغا: 'يريد', عليا: 'علي',
  عرف: 'اعرف', خرج: 'اخرج', دخل: 'ادخل', عطي: 'اعط', ناخد: 'اخذ', خد: 'خذ', جيبلي: 'احضر لي',
  خدام: 'يعمل', خدامه: 'تعمل', شغال: 'يعمل', شغاله: 'تعمل', مزيان: 'جيد', مزيانه: 'جيده',
  باقي: 'ما زال', باقا: 'ما زال', وقع: 'حدث',
};

/**
 * Verb stems whose present/future prefixes (ك, كي, كت, كن, غ, plus a person
 * letter) are stripped. A general prefix rule would turn كتاب into تاب and
 * غياب into a future verb, so only these stems qualify.
 */
const VERB_STEMS = ['شوف', 'دير', 'مشي', 'خلص', 'عرف', 'قدر', 'قلب', 'زيد', 'مسح', 'بدل', 'خرج', 'دخل', 'شري', 'حيد', 'خوي', 'سجل'];
const VERB_PREFIX = new RegExp(`${START}(?:كي|كت|كن|ك|غ)([نتي]?)(${VERB_STEMS.join('|')})(و|ي|ين)?${END}`, 'g');
/** نزيد, نشوفو: the bare first-person prefix before the same stems. */
const FIRST_PERSON = new RegExp(`${START}ن(${VERB_STEMS.join('|')})(و)?${END}`, 'g');
/** زيدلي, حطها, حيدهم: an object pronoun attached to an imperative. */
const OBJECT_STEMS = [...VERB_STEMS, 'حط', 'جيب', 'عطي', 'صيفط'];
const OBJECT_SUFFIX = new RegExp(`${START}(${OBJECT_STEMS.join('|')})(?:ليا|لي|لينا|ليه|ليها|ليهم|ها|هم)${END}`, 'g');
/** ما…ش around a stem of three or more letters: ماخلصتش → لم خلصت. */
const JOINED_NEGATION = new RegExp(`${START}ما([ء-ي]{3,})ش${END}`, 'g');

/** Tatweel, letters stretched three or more times, Arabic-Indic digits. */
function cleanArabic(text: string): string {
  return text
    .replace(/ـ/g, '')
    .replace(/([ء-ي])\1{2,}/g, '$1')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function compileRule(rule: DarijaRewriteRule): [RegExp, string] {
  if (typeof rule.from !== 'string' || typeof rule.to !== 'string') {
    throw new TypeError('Darija rewrite rules need string from/to values');
  }
  const parts = rule.from.trim().split(/\s+/).map(keyOf);
  if (!parts.length || parts.some((word) => !ARABIC_KEY.test(word))) {
    throw new TypeError('Darija rewrite rules must contain literal Arabic words');
  }
  // The attached conjunction is kept; the replacement is literal, never a
  // JavaScript replacement template or executable regular expression.
  return [new RegExp(`${START}(و[ً-ْ]*)?${parts.map(vowelledWord).join('\\s+')}${END}`, 'g'), rule.to];
}

/**
 * Opt-in Moroccan Darija → MSA helper for rag({ rewriteRoutingQuery }).
 * The hook receives normalized text. Only routing/preview embeddings use its
 * result; the user's message, knowledge search and tool authorization stay as-is.
 * This is a vocabulary preset, not a complete dialect translator.
 */
export function createDarijaQueryRewriter(options: DarijaQueryRewriteOptions = {}): RoutingQueryRewrite {
  const words = new Map(Object.entries(WORDS));
  // Latin-script (Arabizi) words come only from the app; none are preset,
  // because many Arabizi spellings are also French or English words.
  const latinWords = new Map<string, string>();
  for (const [word, replacement] of Object.entries(options.words ?? {})) {
    if (replacement !== null && typeof replacement !== 'string') {
      throw new TypeError('Darija word overrides need a string or null');
    }
    const latin = word.trim().toLowerCase();
    if (LATIN_KEY.test(latin)) {
      if (replacement === null) latinWords.delete(latin);
      else latinWords.set(latin, replacement);
      continue;
    }
    const key = keyOf(word.trim());
    if (!ARABIC_KEY.test(key)) {
      throw new TypeError('Darija word overrides need one Arabic or Latin-script word');
    }
    if (replacement === null) words.delete(key);
    else words.set(key, replacement);
  }
  const rules = [
    ...(options.rewriteRules ?? []),
    { from: 'شحال من', to: 'كم عدد' },
  ].map(compileRule);
  const maxLength = Math.max(0, ...[...words.keys()].map((word) => word.length));
  const negation = new RegExp(`${START}${vowelledWord('ما')}\\s+([ء-يً-ْ]+)${END}`, 'g');

  function rewriteWord(word: string): string {
    const marked = keyOf(word);
    const bare = marked.replace(DIACRITICS, '');
    let offset = 0;
    let markedOffset = 0;
    while (offset < bare.length) {
      const remaining = bare.length - offset;
      if (remaining <= maxLength) {
        const suffix = marked.slice(markedOffset);
        const replacement = words.get(suffix) ?? words.get(bare.slice(offset));
        if (replacement !== undefined) return replacement ? `${bare.slice(0, offset)}${replacement}` : '';
      }
      if (remaining > 4 && bare.startsWith('فال', offset)) {
        const noun = bare.slice(offset + 1);
        return `${bare.slice(0, offset)}في ${words.get(noun) ?? noun}`;
      }
      if (remaining <= 2 || bare[offset] !== 'و') break;
      offset++;
      markedOffset++;
      if (marked[markedOffset] === 'ّ') markedOffset++;
    }
    return word;
  }

  return (normalized) => {
    let text = cleanArabic(normalized);
    // Rules come first: an app writes them in the user's wording (بغيت نعرف).
    for (const [pattern, replacement] of rules) {
      text = text.replace(pattern, (_match, before: string, and: string | undefined) =>
        `${before}${replacement && and ? 'و' : ''}${replacement}`);
    }
    // A joined negation the word list knows (ماكاينش) is left to the list.
    text = text.replace(JOINED_NEGATION, (match, before: string, stem: string) =>
      (words.has(keyOf(`ما${stem}ش`).replace(DIACRITICS, '')) ? match : `${before}لم ${stem}`));
    text = text.replace(VERB_PREFIX, (_match, before: string, _person: string, stem: string) => `${before}${stem}`);
    // A form the word list knows (نشوف, زيدها) is left to the list.
    text = text.replace(FIRST_PERSON, (match, before: string, stem: string, plural?: string) =>
      (words.has(`ن${stem}${plural ?? ''}`) ? match : `${before}${stem}`));
    text = text.replace(OBJECT_SUFFIX, (match, before: string, stem: string) =>
      (words.has(keyOf(match.slice(before.length))) ? match : `${before}${stem}`));
    text = text.replace(negation, (match, before: string, verb: string) => {
      const joined = `ما${keyOf(verb).replace(DIACRITICS, '')}`;
      return words.has(joined) ? `${before}${joined}` : match;
    });
    text = text.replace(ARABIC_WORD, rewriteWord);
    if (latinWords.size > 0) {
      text = text.replace(LATIN_WORD, (word) => latinWords.get(word.toLowerCase()) ?? word);
    }
    return text.replace(/ {2,}/g, ' ').trim();
  };
}
