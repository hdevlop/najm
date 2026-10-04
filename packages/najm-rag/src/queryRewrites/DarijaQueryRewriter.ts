import type { RoutingQueryRewrite } from '../config';

export interface DarijaRewriteRule {
  from: string;
  to: string;
}

export interface DarijaQueryRewriteOptions {
  /** App vocabulary overrides the preset. Use null to disable a preset word. */
  words?: Readonly<Record<string, string | null>>;
  /** Literal Arabic word sequences, applied before word rewriting. */
  rewriteRules?: readonly DarijaRewriteRule[];
}

// Restored from the published najm-rag@2.3.0 artifact to preserve its API.
const DIACRITICS = /[ً-ْ]/g;
const VOWELS = /[ً-ِْ]/g;
const ARABIC_WORD = /[ء-يً-ْ]+/g;
const ARABIC_KEY = /^[ء-يً-ْ]+$/;
const fold = (text: string) => text.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
const keyOf = (text: string) => fold(text).replace(VOWELS, "");
const vowelledWord = (word: string) => [...word].join("[ً-ِْ]*") + "[ً-ِْ]*";
const START = "(^|[^ء-يً-ْ])";
const END = "(?=$|[^ء-يً-ْ])";
const WORDS: Record<string, string> = {
  شحال: "كم",
  قداش: "كم",
  شنو: "ما",
  شنوا: "ما",
  اشنو: "ما",
  شكون: "من",
  هوما: "هم",
  واش: "هل",
  فين: "اين",
  فاين: "اين",
  امتي: "متى",
  فوقاش: "متى",
  علاش: "لماذا",
  كيفاش: "كيف",
  وريني: "اعرض",
  وريلي: "اعرض",
  ورينا: "اعرض",
  عطيني: "اعرض",
  جيب: "اعرض",
  قلب: "ابحث",
  لقي: "جد",
  بغيت: "اريد",
  بغينا: "نريد",
  خصني: "احتاج",
  دير: "انشئ",
  ديري: "انشئ",
  صيفط: "ارسل",
  ليا: "لي",
  ليه: "له",
  ليها: "لها",
  ليهم: "لهم",
  كاين: "يوجد",
  كاينين: "يوجد",
  كاينه: "توجد",
  كاينش: "لا يوجد",
  ماكاينش: "لا يوجد",
  كاينينش: "لا يوجد",
  هاد: "هذا",
  هاذ: "هذا",
  هادا: "هذا",
  هادي: "هذه",
  هاذي: "هذه",
  داك: "ذلك",
  ديك: "تلك",
  ديال: "",
  ديالو: "",
  ديالها: "",
  ديالهم: "",
  ديالي: "",
  ديالنا: "",
  ديالك: "",
  بلي: "ان",
  اللي: "الذي",
  بزاف: "كثير",
  مازال: "ما زال",
  مزال: "ما زال",
  غادي: "سوف",
  تسد: "تغلق",
  بكري: "مبكرا",
  تقدر: "تستطيع",
  دابا: "الان",
  البارح: "امس",
  نهار: "يوم",
  السيمانه: "الاسبوع",
  سيمانه: "اسبوع",
  العشيه: "المساء",
  جاي: "القادم",
  الجاي: "القادم",
  جايه: "القادمه",
  الجايه: "القادمه",
  جايين: "القادمه"
};
function compileRule(rule: DarijaRewriteRule): [RegExp, string] {
  if (typeof rule.from !== "string" || typeof rule.to !== "string") {
    throw new TypeError("Darija rewrite rules need string from/to values");
  }
  const parts = rule.from.trim().split(/\s+/).map(keyOf);
  if (!parts.length || parts.some((word) => !ARABIC_KEY.test(word))) {
    throw new TypeError("Darija rewrite rules must contain literal Arabic words");
  }
  return [new RegExp(`${START}(و[ً-ْ]*)?${parts.map(vowelledWord).join("\\s+")}${END}`, "g"), rule.to];
}
export function createDarijaQueryRewriter(options: DarijaQueryRewriteOptions = {}): RoutingQueryRewrite {
  const words = new Map(Object.entries(WORDS));
  for (const [word, replacement] of Object.entries(options.words ?? {})) {
    const key = keyOf(word.trim());
    if (!ARABIC_KEY.test(key) || replacement !== null && typeof replacement !== "string") {
      throw new TypeError("Darija word overrides need an Arabic word and a string or null");
    }
    if (replacement === null)
      words.delete(key);
    else
      words.set(key, replacement);
  }
  const rules = [
    ...options.rewriteRules ?? [],
    { from: "شحال من", to: "كم عدد" }
  ].map(compileRule);
  const maxLength = Math.max(0, ...[...words.keys()].map((word) => word.length));
  const negation = new RegExp(`${START}${vowelledWord("ما")}\\s+([ء-يً-ْ]+)${END}`, "g");
  function rewriteWord(word: string): string {
    const marked = keyOf(word);
    const bare = marked.replace(DIACRITICS, "");
    let offset = 0;
    let markedOffset = 0;
    while (offset < bare.length) {
      const remaining = bare.length - offset;
      if (remaining <= maxLength) {
        const suffix = marked.slice(markedOffset);
        const replacement = words.get(suffix) ?? words.get(bare.slice(offset));
        if (replacement !== void 0)
          return replacement ? `${bare.slice(0, offset)}${replacement}` : "";
      }
      if (remaining > 4 && bare.startsWith("فال", offset)) {
        const noun = bare.slice(offset + 1);
        return `${bare.slice(0, offset)}في ${words.get(noun) ?? noun}`;
      }
      if (remaining <= 2 || bare[offset] !== "و")
        break;
      offset++;
      markedOffset++;
      if (marked[markedOffset] === "ّ")
        markedOffset++;
    }
    return word;
  }
  return (normalized: string) => {
    let text = normalized;
    for (const [pattern, replacement] of rules) {
      text = text.replace(pattern, (_match, before, and) => `${before}${replacement && and ? "و" : ""}${replacement}`);
    }
    text = text.replace(negation, (match, before, verb) => {
      const joined = `ما${keyOf(verb).replace(DIACRITICS, "")}`;
      return words.has(joined) ? `${before}${joined}` : match;
    });
    return text.replace(ARABIC_WORD, rewriteWord).replace(/ {2,}/g, " ").trim();
  };
}
