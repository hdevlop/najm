import type { UIMessage } from 'ai';

export const CHAT_SESSION_CHANNELS = ['web', 'whatsapp', 'other'] as const;
export type ChatSessionChannel = (typeof CHAT_SESSION_CHANNELS)[number];

export interface ChatSessionMeta {
  userId?: string | null;
  channel?: string | null;
  expiresAt?: string | Date | null;
}

export interface StoredChatSession {
  id: string;
  sessionKey: string;
  userId: string | null;
  channel: ChatSessionChannel;
  messages: UIMessage[];
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  expiresAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const CHAT_SESSION_CLEANUP_EVENT = 'ChatSessionCleanup';

export const normalizeChatChannel = (channel?: string | null): ChatSessionChannel => {
  if (channel === 'web' || channel === 'whatsapp') return channel;
  return 'other';
};

export const ttlToExpiresAt = (ttlMs?: number | null, now = new Date()): string | null => {
  if (!ttlMs || !Number.isFinite(ttlMs) || ttlMs <= 0) return null;
  return new Date(now.getTime() + ttlMs).toISOString();
};

const ZONE_SUFFIX = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

/**
 * Parses a stored time. Expiry is always written as UTC, but PostgreSQL's
 * `timestamp without time zone` drops the zone and returns e.g.
 * '2026-11-14 12:00:00'; JavaScript would read that as local time, so a
 * string without a zone is read as UTC.
 */
function parseStoredTime(value: string | Date): Date {
  if (value instanceof Date) return value;
  const text = value.trim();
  return new Date(ZONE_SUFFIX.test(text) ? text : `${text.replace(' ', 'T')}Z`);
}

export const normalizeExpiresAt = (value?: string | Date | null): string | null => {
  if (!value) return null;
  const parsed = parseStoredTime(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : (value instanceof Date ? null : value);
};

export const isExpired = (expiresAt?: string | Date | null, now = new Date()): boolean => {
  if (!expiresAt) return false;
  const expiresTime = parseStoredTime(expiresAt).getTime();
  return Number.isFinite(expiresTime) && expiresTime <= now.getTime();
};
