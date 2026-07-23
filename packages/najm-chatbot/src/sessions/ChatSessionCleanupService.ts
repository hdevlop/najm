import { Inject, Meta, Service } from 'najm-core';
import { EventService } from 'najm-event';
import { CHATBOT_CONFIG } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { ChatSessionRepository } from './ChatSessionRepository';
import { CHAT_SESSION_CLEANUP_EVENT } from './ChatSessionSchema';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Service()
@Meta({ layer: 'plugin', order: 90 })
export class ChatSessionCleanupService {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private repository: ChatSessionRepository,
    private events: EventService,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
  ) {}

  async onReady(): Promise<void> {
    if (this.timer || this.config.conversationStore !== 'db') return;

    this.timer = setInterval(() => {
      void this.cleanup();
    }, CLEANUP_INTERVAL_MS);
    (this.timer as any)?.unref?.();
  }

  async onDestroy(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async cleanup(now = new Date()): Promise<number> {
    this.events.emit(CHAT_SESSION_CLEANUP_EVENT, { now });
    return this.repository.deleteExpired(now);
  }
}
