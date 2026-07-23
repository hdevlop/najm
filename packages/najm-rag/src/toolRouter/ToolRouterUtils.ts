export const DEFAULT_DANGEROUS_PATTERNS = [
  'destructive',
  'delete',
  'remove',
  'destroy',
  'bulk_delete',
  'refund',
  'reset',
  'send',
  'notify',
];

export const DEFAULT_INTENT_KEYWORDS: Record<string, string[]> = {
  destructive: ['delete', 'remove', 'destroy', 'bulk', 'supprimer', 'حذف', 'مسح'],
  delete: ['delete', 'remove', 'supprimer', 'حذف', 'مسح'],
  send: ['send', 'envoyer', 'ارسل', 'صيفط'],
  refund: ['refund', 'rembourser', 'استرجاع'],
  destroy: ['delete', 'remove', 'destroy', 'حذف', 'مسح'],
  bulk_delete: ['delete', 'remove', 'bulk', 'حذف', 'مسح'],
  reset: ['reset', 'restore', 'استعادة'],
  notify: ['send', 'notify', 'alert', 'envoyer', 'ارسل', 'صيفط'],
};

export function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function normalizeQuery(query: string): string {
  return normalizeArabic(query.trim().toLowerCase());
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();

  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(aObj[aKeys[i]], bObj[bKeys[i]])) return false;
  }
  return true;
}

export { EmbeddingLru } from '../embeddings/EmbeddingUtils';
