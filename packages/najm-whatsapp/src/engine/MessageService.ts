import { Service, Meta, Inject } from 'najm-core';
import { InstanceManager } from './InstanceManager';
import { MessageStoreService } from './MessageStoreService';
import type { WAMessageKey } from '@whiskeysockets/baileys';

@Service()
@Meta({ layer: 'plugin' })
export class MessageService {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageStoreService) private messageStore!: MessageStoreService;

  private getAdapter(instanceId: string) {
    return this.instances.getInstance(instanceId).getAdapter();
  }

  async sendText(instanceId: string, jid: string, text: string, options?: any) {
    return this.getAdapter(instanceId).sendText(jid, text, options);
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
