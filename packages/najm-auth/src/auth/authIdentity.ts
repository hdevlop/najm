const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Normalize an authentication identifier for both login resolution and
 * rate-limit bucketing. Email comparison is case-insensitive. Phone login uses
 * an E.164-compatible value and accepts common visual separators plus a `00`
 * international prefix.
 */
export function normalizeAuthIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;

  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  const compact = trimmed.replace(/[\s().-]+/g, '');
  const international = compact.startsWith('00')
    ? `+${compact.slice(2)}`
    : compact;

  return PHONE_PATTERN.test(international) ? international : null;
}

export function isEmailIdentifier(value: string): boolean {
  return value.includes('@');
}
