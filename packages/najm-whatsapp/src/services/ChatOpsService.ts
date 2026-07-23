import { Service, Meta, Inject } from 'najm-core';
import { InstanceManager } from '../engine/InstanceManager';
import { MessageStoreService } from '../engine/MessageStoreService';
import type { WAMessageKey } from '@whiskeysockets/baileys';

@Service()
@Meta({ layer: 'plugin' })
export class ChatOpsService {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageStoreService) private store!: MessageStoreService;

  async archiveChat(instanceId: string, jid: string, archive: boolean) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    const lastMessages = await this.getLastMessages(instanceId, jid);
    return adapter.archiveChat(jid, archive, lastMessages);
  }

  async pinChat(instanceId: string, jid: string, pin: boolean) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.pinChat(jid, pin);
  }

  async muteChat(instanceId: string, jid: string, duration: number | null) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.muteChat(jid, duration);
  }

  async deleteChat(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    const lastMessages = await this.getLastMessages(instanceId, jid);
    return adapter.deleteChat(jid, lastMessages);
  }

  async markRead(instanceId: string, jid: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    const lastMessages = await this.getLastMessages(instanceId, jid);
    return adapter.markRead(jid, lastMessages);
  }

  async readMessages(instanceId: string, keys: Array<{ remoteJid: string; id: string; fromMe?: boolean }>) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.readMessages(keys as WAMessageKey[]);
  }

  private async getLastMessages(instanceId: string, jid: string): Promise<any[]> {
    const msgs = await this.store.getMessages(instanceId, jid, 10);
    return msgs.map((m: any) => ({
      key: { remoteJid: m.jid, id: m.waMessageId, fromMe: m.fromMe },
      messageTimestamp: this.toUnixTimestamp(m.timestamp),
    }));
  }

  private toUnixTimestamp(value: string | number | Date): number {
    if (typeof value === 'number') return value;
    if (value instanceof Date) return Math.floor(value.getTime() / 1000);
    if (/^\d+$/.test(value)) return Number(value);
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
  }
}
