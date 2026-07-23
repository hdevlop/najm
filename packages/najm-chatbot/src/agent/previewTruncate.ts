const HARD_MAX_CHARS = 2000;
const DEFAULT_MAX_CHARS = 500;
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_ARRAY_ITEMS = 10;
const DEFAULT_REDACT_KEYS = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];

export interface TruncationOptions {
  maxChars: number;
  maxDepth: number;
  maxArrayItems: number;
  redactKeys: string[];
}

function normalizeOptions(options?: Partial<TruncationOptions>): TruncationOptions {
  const maxChars = Math.min(options?.maxChars ?? DEFAULT_MAX_CHARS, HARD_MAX_CHARS);
  return {
    maxChars,
    maxDepth: options?.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxArrayItems: options?.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS,
    redactKeys: options?.redactKeys ?? DEFAULT_REDACT_KEYS,
  };
}

function isRedactKey(key: string, redactKeys: string[]): boolean {
  const lower = key.toLowerCase();
  return redactKeys.some((k) => lower.includes(k.toLowerCase()));
}

function redactValue(): unknown {
  return '[REDACTED]';
}

export function truncatePreview(value: unknown, options?: Partial<TruncationOptions>): unknown {
  const opts = normalizeOptions(options);
  const redacted = processValue(value, opts, 0);
  const serialized = JSON.stringify(redacted);
  if (serialized.length > opts.maxChars) {
    const clipped = serialized.slice(0, opts.maxChars);
    return { type: 'preview', value: clipped, truncated: true };
  }
  return redacted;
}

function processValue(value: unknown, opts: TruncationOptions, depth: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return processArray(value, opts, depth);
  }

  if (typeof value === 'object') {
    return processObject(value as Record<string, unknown>, opts, depth);
  }

  return String(value);
}

function processArray(value: unknown[], opts: TruncationOptions, depth: number): unknown {
  if (depth >= opts.maxDepth) {
    return { type: 'object', truncated: true, reason: 'max_depth' };
  }

  if (value.length > opts.maxArrayItems) {
    const items = value.slice(0, opts.maxArrayItems).map((v) => processValue(v, opts, depth + 1));
    return { type: 'array', length: value.length, items, truncated: true };
  }

  const processed = value.map((v) => processValue(v, opts, depth + 1));
  return processed;
}

function processObject(value: Record<string, unknown>, opts: TruncationOptions, depth: number): unknown {
  if (depth >= opts.maxDepth) {
    return { type: 'object', truncated: true, reason: 'max_depth' };
  }

  const result: Record<string, unknown> = {};
  const keys = Object.keys(value);

  for (const key of keys) {
    if (isRedactKey(key, opts.redactKeys)) {
      result[key] = redactValue();
    } else {
      result[key] = processValue(value[key], opts, depth + 1);
    }
  }

  return result;
}