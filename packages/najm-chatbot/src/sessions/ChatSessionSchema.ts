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

export const normalizeExpiresAt = (value?: string | Date | null): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

export const isExpired = (expiresAt?: string | Date | null, now = new Date()): boolean => {
  if (!expiresAt) return false;
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const expiresTime = expires.getTime();
  return Number.isFinite(expiresTime) && expiresTime <= now.getTime();
};
