import { Inject, Meta, Service } from 'najm-core';
import { CacheService } from 'najm-cache';
import type { UIMessage } from 'ai';
import { CHATBOT_CONFIG } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { ChatSessionRepository } from './ChatSessionRepository';
import { normalizeChatChannel, ttlToExpiresAt, type ChatSessionMeta } from './ChatSessionSchema';

export interface ConversationStore {
  load(key: string): Promise<UIMessage[] | null>;
  save(key: string, messages: UIMessage[], meta?: ChatSessionMeta & { title?: string | null }): Promise<void>;
  clear(key: string): Promise<void>;
}

interface CacheSessionPayload {
  messages: UIMessage[];
  meta: {
    userId: string | null;
    channel: string;
    savedAt: string;
  };
}

const cacheKey = (key: string) => `najm:chatbot:sessions:${key}`;

@Service()
@Meta({ layer: 'plugin', order: 50 })
export class DbConversationStore implements ConversationStore {
  constructor(
    private repository: ChatSessionRepository,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
  ) {}

  async load(key: string): Promise<UIMessage[] | null> {
    const session = await this.repository.findByKey(key);
    return session?.messages ?? null;
  }

  async save(key: string, messages: UIMessage[], meta: ChatSessionMeta & { title?: string | null } = {}): Promise<void> {
    await this.repository.save({
      sessionKey: key,
      messages,
      userId: meta.userId ?? null,
      channel: meta.channel ?? 'other',
      title: meta.title ?? null,
      expiresAt: meta.expiresAt ?? ttlToExpiresAt(this.config.sessionTtl),
    });
  }

  async clear(key: string): Promise<void> {
    await this.repository.deleteByKey(key);
  }
}

@Service()
@Meta({ layer: 'plugin', order: 51 })
export class CacheConversationStore implements ConversationStore {
  constructor(
    private cache: CacheService,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
  ) {}

  async load(key: string): Promise<UIMessage[] | null> {
    const payload = await this.cache.getJson<CacheSessionPayload>(cacheKey(key));
    return payload?.messages ?? null;
  }

  async save(key: string, messages: UIMessage[], meta: ChatSessionMeta = {}): Promise<void> {
    await this.cache.setJson<CacheSessionPayload>(
      cacheKey(key),
      {
        messages,
        meta: {
          userId: meta.userId ?? null,
          channel: normalizeChatChannel(meta.channel),
          savedAt: new Date().toISOString(),
        },
      },
      this.config.sessionTtl,
    );
  }

  async clear(key: string): Promise<void> {
    await this.cache.del(cacheKey(key));
  }
}
