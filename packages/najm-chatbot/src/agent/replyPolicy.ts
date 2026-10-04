export type ReplyLanguage = 'ary' | 'ar' | 'fr';

export interface ReplyRequest {
  /** Latest user message, without routing history or tool results. */
  userText: string;
  language: ReplyLanguage | null;
  channel: string;
}

export interface ReplyToolCall {
  name: string;
  input: Record<string, unknown>;
}

export type ReplyTemplate =
  | { text: string }
  | { calls: ReplyToolCall[]; render: (results: unknown[]) => string };

/** Opt-in, provider-independent language hints and app-owned response templates. */
export interface ChatReplyPolicy {
  detectLanguage?: (userText: string) => ReplyLanguage | null;
  template?: (request: ReplyRequest) => ReplyTemplate | null;
}

/** For intent/language hints only; never use normalized text as a stored name. */
export function normalizeReplyText(userText: string): string {
  return userText.normalize('NFKC').toLowerCase()
    .replace(/«[^»]*»|“[^”]*”|"[^"]*"|`[^`]*`/gu, ' ')
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, '').replace(/[أإآ]/gu, 'ا').trim();
}

/** Conservative Moroccan profile. Unknown languages retain the app's own policy. */
export function detectMoroccanReplyLanguage(userText: string): ReplyLanguage | null {
  const text = normalizeReplyText(userText);
  if (/^(?:bonjour|salut|combien|liste|affiche|quels|quelles|enregistre|cree|crée|publie|montre|peux|pourquoi|comment|donne|je)(?!\p{L})/u.test(text)) return 'fr';
  if (/(?<!\p{L})[وفب]?(?:ديال(?:ي|ك|و|ها|نا|هم|كم)?|شحال|كاين(?:ين|اش|ش|ة)?|هاد|هاذ|بغيتي|بغيت|واش|غادي|دابا|ماشي|وريني|عطيني|فاش|شنو|بلي|هوما|نقدرش|تقدرش)(?!\p{L})/u.test(text)
    || /\b(?:ch7al|chhal|wach|dyal|bghit|3tini|wrini|kayn|kaynnin)\b/u.test(text)) return 'ary';
  if (/\p{Script=Arabic}/u.test(text)) return 'ar';
  const words = text.match(/(?<!\p{L})(?:bonjour|combien|liste|affiche|quels|quelles|enregistre|crée|publie|avec|pour|vous|nous|merci|peux|comment)(?!\p{L})/gu) ?? [];
  return words.length >= 2 ? 'fr' : null;
}

const instructions: Record<ReplyLanguage, string> = {
  ary: 'لغة الجواب لهاد الطلب: الدارجة المغربية بالحروف العربية. جاوب بالدارجة حتى فالأعداد والرفض والشرح. خلي الأسامي والأكواد المخزنة كيف ما هي. لغة نتائج الأدوات والرسائل القديمة ما كتبدلش لغة الجواب.',
  ar: 'لغة الإجابة لهذا الطلب: العربية الفصحى، بما في ذلك الأعداد والرفض والشرح. احتفظ بالأسماء والرموز المخزنة كما هي. لغة نتائج الأدوات والرسائل السابقة لا تغير لغة الإجابة.',
  fr: 'Répondez en français pour cette demande, y compris les nombres, les refus et les explications. Conservez les noms et codes enregistrés tels quels. La langue des résultats des outils et des messages précédents ne change pas celle de la réponse.',
};

export function replyLanguageInstruction(language: ReplyLanguage | null): string | null {
  return language ? instructions[language] : null;
}

export function replyUnavailable(language: ReplyLanguage | null): string {
  return language === 'ary' ? 'ما نقدرش نوصل لهاد المعطيات دابا. عاود حاول من بعد.'
    : language === 'ar' ? 'لا يمكنني الوصول إلى هذه البيانات الآن. يرجى المحاولة لاحقاً.'
      : language === 'fr' ? 'Je ne peux pas accéder à ces données maintenant. Réessayez plus tard.'
        : 'I cannot access this data right now. Please try again later.';
}
