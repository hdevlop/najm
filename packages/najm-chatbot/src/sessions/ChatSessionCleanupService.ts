import { Inject, Meta, Service } from 'najm-core';
import { EventService } from 'najm-event';
import { CHATBOT_CONFIG } from '../tokens';
import type { ChatbotConfig } from '../ChatbotPlugin';
import { ChatSessionRepository } from './ChatSessionRepository';
import { ChatLogRepository } from '../chatLogs/ChatLogRepository';
import { CHAT_SESSION_CLEANUP_EVENT } from './ChatSessionSchema';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hourly pass that removes expired sessions and, when configured, old interaction logs. */
@Service()
@Meta({ layer: 'plugin', order: 90 })
export class ChatSessionCleanupService {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private repository: ChatSessionRepository,
    private events: EventService,
    @Inject(CHATBOT_CONFIG) private config: ChatbotConfig,
    private logs: ChatLogRepository,
  ) {}

  private get logRetentionDays(): number {
    const days = this.config.chatLogging?.retentionDays;
    return typeof days === 'number' && days > 0 ? days : 0;
  }

  async onReady(): Promise<void> {
    if (this.timer) return;
    if (this.config.conversationStore !== 'db' && this.logRetentionDays === 0) return;

    this.timer = setInterval(() => {
      void this.cleanup().catch(() => {});
    }, CLEANUP_INTERVAL_MS);
    (this.timer as any)?.unref?.();
  }

  async onDestroy(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Returns the number of expired sessions removed. */
  async cleanup(now = new Date()): Promise<number> {
    this.events.emit(CHAT_SESSION_CLEANUP_EVENT, { now });
    if (this.logRetentionDays > 0) {
      await this.logs.deleteOlderThan(new Date(now.getTime() - this.logRetentionDays * DAY_MS));
    }
    return this.config.conversationStore === 'db' ? this.repository.deleteExpired(now) : 0;
  }
}
