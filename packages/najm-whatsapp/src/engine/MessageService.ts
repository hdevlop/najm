import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { InstanceManager } from './InstanceManager';
import { MessageStoreService, SaveMessageInput } from './MessageStoreService';
import type { WAMessageKey } from '@whiskeysockets/baileys';

@Service()
@Meta({ layer: 'plugin' })
export class MessageService {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageStoreService) private messageStore!: MessageStoreService;
  @Inject(LoggerService) private log?: LoggerService;

  private getAdapter(instanceId: string) {
    return this.instances.getInstance(instanceId).getAdapter();
  }

  async sendText(instanceId: string, jid: string, text: string, options?: any) {
    const result = await this.getAdapter(instanceId).sendText(jid, text, options);
    try {
      const key = result?.key ?? {};
      const ts = result?.messageTimestamp;
      const tsIso =
        typeof ts === 'number'
          ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString()
          : new Date().toISOString();
      const input: SaveMessageInput = {
        direction: 'outbound',
        jid,
        fromMe: true,
        type: 'text',
        content: { text },
        waMessageId: key?.id ?? undefined,
        timestamp: tsIso,
        status: 'sent',
      };
      await this.messageStore.saveMessage(instanceId, input);
    } catch (err: any) {
      this.log?.warn?.(`[najm-whatsapp] persist outbound failed: ${err?.message ?? err}`);
    }
    return result;
  }

  async sendImage(instanceId: string, jid: string, url: string, caption?: string) {
    return this.getAdapter(instanceId).sendImage(jid, { url }, caption);
  }

  async sendLocation(
    instanceId: string,
    jid: string,
    lat: number,
    lng: number,
    name?: string,
    address?: string,
  ) {
    return this.getAdapter(instanceId).sendLocation(jid, lat, lng, name, address);
  }

  async readMessages(instanceId: string, keys: WAMessageKey[]) {
    return this.getAdapter(instanceId).readMessages(keys as WAMessageKey[]);
  }

  async requestHistory(instanceId: string, jid: string, count: number) {
    const oldest = await this.messageStore.getOldestMessage(instanceId, jid);
    if (!oldest) {
      return { requestId: null, message: 'No messages found to use as cursor' };
    }

    if (!oldest.waMessageId) {
      return { requestId: null, message: 'Oldest message has no waMessageId' };
    }

    const oldestKey: WAMessageKey = {
      remoteJid: jid,
      id: oldest.waMessageId,
      fromMe: oldest.fromMe,
    };

    const timestamp = typeof oldest.timestamp === 'string'
      ? Math.floor(new Date(oldest.timestamp).getTime() / 1000)
      : Number(oldest.timestamp);

    const requestId = await this.getAdapter(instanceId).fetchMessageHistory(
      count,
      oldestKey,
      timestamp,
    );

    return { requestId, message: 'History fetch initiated' };
  }
}
