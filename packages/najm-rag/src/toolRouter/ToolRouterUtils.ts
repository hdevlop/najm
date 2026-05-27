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

interface LruEntry {
  key: string;
  value: number[];
  prev: LruEntry | null;
  next: LruEntry | null;
}

export class EmbeddingLru {
  private map = new Map<string, LruEntry>();
  private head: LruEntry | null = null;
  private tail: LruEntry | null = null;

  constructor(private maxSize: number) {}

  get(key: string): number[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    this.moveToFront(entry);
    return entry.value;
  }

  set(key: string, value: number[]): void {
    if (this.maxSize <= 0) return;

    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    const entry: LruEntry = { key, value, prev: null, next: this.head };
    if (this.head) this.head.prev = entry;
    this.head = entry;
    if (!this.tail) this.tail = entry;

    this.map.set(key, entry);

    if (this.map.size > this.maxSize) {
      this.evictTail();
    }
  }

  private moveToFront(entry: LruEntry): void {
    if (entry === this.head) return;

    if (entry.prev) entry.prev.next = entry.next;
    if (entry.next) entry.next.prev = entry.prev;
    if (entry === this.tail) this.tail = entry.prev;

    entry.prev = null;
    entry.next = this.head;
    if (this.head) this.head.prev = entry;
    this.head = entry;
  }

  private evictTail(): void {
    if (!this.tail) return;
    this.map.delete(this.tail.key);

    if (this.tail.prev) {
      this.tail.prev.next = null;
      this.tail = this.tail.prev;
    } else {
      this.head = null;
      this.tail = null;
    }
  }
}
