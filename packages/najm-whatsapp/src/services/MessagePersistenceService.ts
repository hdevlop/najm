/**
 * MessagePersistenceService — persists inbound and outbound messages.
 *
 * Inbound persistence is driven by a `@On('whatsapp.message')` handler so the
 * Baileys runtime event pipeline writes history automatically. Outbound
 * messages are persisted by `MessageService.sendText` after a successful
 * Baileys send, using the returned key/timestamp.
 *
 * Deduplication relies on the `(instanceId, waMessageId)` unique index because
 * Baileys re-fires the same message as both `notify` and `append` upserts.
 */
import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { On } from 'najm-event';
import { MessageStoreService, SaveMessageInput } from '../engine/MessageStoreService';
import { WHATSAPP_EVENTS, type WhatsAppMessageEvent } from '../events';

@Service()
@Meta({ layer: 'plugin' })
export class MessagePersistenceService {
  @Inject(MessageStoreService) private store!: MessageStoreService;
  @Inject(LoggerService) private log?: LoggerService;

  @On(WHATSAPP_EVENTS.message)
  async onMessage(event: WhatsAppMessageEvent): Promise<void> {
    if (!event?.instanceId) return;
    try {
      const input: SaveMessageInput = {
        direction: event.fromMe ? 'outbound' : 'inbound',
        jid: event.jid || event.from,
        fromMe: !!event.fromMe,
        type: event.type || 'text',
        content: event.text ? { text: event.text } : undefined,
        waMessageId: event.messageId || undefined,
        timestamp: event.timestamp || new Date().toISOString(),
      };
      await this.store.saveMessage(event.instanceId, input);
    } catch (err: any) {
      this.log?.warn?.(`[najm-whatsapp] persist inbound failed: ${err?.message ?? err}`);
    }
  }
}
