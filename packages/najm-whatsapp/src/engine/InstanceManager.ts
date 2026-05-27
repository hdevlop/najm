/**
 * InstanceManager — manages multiple Baileys instances.
 *
 * Owns the registry of active instances and their metadata.
 * Resolves SessionStore via DI; instantiates BaileysInstance per instance ID.
 */
import { Service, Meta, Inject } from 'najm-core';
import { EventService } from 'najm-event';
import { BaileysInstance, InstanceStatus } from './BaileysInstance';
import { SessionStore } from './SessionStore';

export interface InstanceInfo {
  id: string;
  name: string;
  status: InstanceStatus;
  phone?: string;
  profileName?: string;
  qrCode?: string;
  lastError?: string;
  connectedAt?: string;
  createdAt: string;
  messageCount?: number;
  contactCount?: number;
}

@Service()
@Meta({ layer: 'plugin' })
export class InstanceManager {
  @Inject(SessionStore) private sessionStore!: SessionStore;
  @Inject(EventService) private events!: EventService;

  private instances = new Map<string, BaileysInstance>();
  private metadata = new Map<string, InstanceInfo>();
  private inflightConnects = new Map<string, Promise<void>>();

  async create(id: string, name: string): Promise<InstanceInfo> {
    if (this.instances.has(id)) {
      throw new Error(`Instance ${id} already exists`);
    }

    const info: InstanceInfo = {
      id,
      name,
      status: 'disconnected',
      createdAt: new Date().toISOString(),
    };

    const instance = new BaileysInstance(id, this.sessionStore);

    instance.onEvent('connection_update', (data: any) => {
      const meta = this.metadata.get(id);
      if (!meta) return;
      meta.status = data.status;
      meta.phone = data.phone ?? meta.phone;
      meta.profileName = data.profileName ?? meta.profileName;
      meta.lastError = this.formatReason(data.reason);
      if (data.status === 'connected') {
        meta.connectedAt = new Date().toISOString();
        meta.qrCode = undefined;
        meta.lastError = undefined;
      }
    });

    instance.onEvent('qr', (data: any) => {
      const meta = this.metadata.get(id);
      if (meta) meta.qrCode = data.qr;
    });

    instance.onEvent('message', (data: any) => {
      if (data.fromMe) return;
      this.events?.emit('whatsapp.message', {
        instanceId: id,
        jid: data.from,
        text: data.text,
        timestamp: data.timestamp,
        raw: data.raw,
      });
    });

    this.metadata.set(id, info);
    this.instances.set(id, instance);

    return info;
  }

  async connect(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance ${id} not found`);

    // Concurrency guard — coalesce overlapping connect calls
    const existing = this.inflightConnects.get(id);
    if (existing) return existing;

    const promise = instance.connect().finally(() => {
      this.inflightConnects.delete(id);
    });
    const meta = this.metadata.get(id);
    if (meta) {
      meta.status = 'connecting';
      meta.lastError = undefined;
    }
    this.inflightConnects.set(id, promise);
    return promise;
  }

  getInstance(id: string): BaileysInstance {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance ${id} not found`);
    return instance;
  }

  getInfo(id: string): InstanceInfo | undefined {
    return this.metadata.get(id);
  }

  list(): InstanceInfo[] {
    return Array.from(this.metadata.values());
  }

  async disconnect(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance ${id} not found`);
    instance.disconnect();
    const meta = this.metadata.get(id);
    if (meta) {
      meta.status = 'disconnected';
      meta.qrCode = undefined;
      meta.lastError = undefined;
    }
  }

  async delete(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (instance) {
      if (this.metadata.get(id)?.status === 'connected') {
        await instance.logout();
      } else {
        instance.disconnect();
        await this.sessionStore.deleteSession(id);
      }
      this.instances.delete(id);
    }
    this.metadata.delete(id);
  }

  async resetSession(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance ${id} not found`);

    instance.disconnect();
    await this.sessionStore.deleteSession(id);

    const meta = this.metadata.get(id);
    if (meta) {
      meta.status = 'connecting';
      meta.qrCode = undefined;
      meta.lastError = undefined;
    }

    await this.connect(id);
  }

  private formatReason(reason: unknown): string | undefined {
    if (!reason) return undefined;
    if (reason instanceof Error) return reason.message;
    if (typeof reason === 'string') return reason;
    try {
      return JSON.stringify(reason);
    } catch {
      return String(reason);
    }
  }
}
