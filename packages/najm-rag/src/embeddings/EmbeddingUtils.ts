interface LruEntry<T> {
  key: string;
  value: T;
  prev: LruEntry<T> | null;
  next: LruEntry<T> | null;
}

export class EmbeddingLru<T = number[]> {
  private map = new Map<string, LruEntry<T>>();
  private head: LruEntry<T> | null = null;
  private tail: LruEntry<T> | null = null;

  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    this.moveToFront(entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.maxSize <= 0) return;

    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    const entry: LruEntry<T> = { key, value, prev: null, next: this.head };
    if (this.head) this.head.prev = entry;
    this.head = entry;
    if (!this.tail) this.tail = entry;

    this.map.set(key, entry);

    if (this.map.size > this.maxSize) {
      this.evictTail();
    }
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private moveToFront(entry: LruEntry<T>): void {
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
