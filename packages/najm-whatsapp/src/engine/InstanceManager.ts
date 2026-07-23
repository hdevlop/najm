/**
 * InstanceManager — manages multiple Baileys instances.
 *
 * Owns the registry of active instances and their metadata. Persistence is
 * delegated to `InstanceRepository`. A single `register(row)` helper builds
 * an in-memory instance, attaches listeners, and stores it. Both `create`
 * and `onReady` flow through `register` so rehydration and first-time create
 * use exactly the same wiring.
 */
import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { EventService } from 'najm-event';
import { BaileysInstance, InstanceStatus } from './BaileysInstance';
import { SessionStore } from './SessionStore';
import { InstanceRepository, PersistedInstance } from './InstanceRepository';

export interface InstanceInfo {
  id: string;
  name: string;
  status: InstanceStatus;
  phone?: string;
  profileName?: string;
  qrCode?: string;
  lastError?: string;
  autoConnect: boolean;
  connectedAt?: string;
  lastSeenAt?: string;
  createdAt: string;
  messageCount?: number;
  contactCount?: number;
}

function toIso(timestamp: unknown): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'number') {
    // Baileys uses seconds; convert to ISO if it looks like seconds.
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof timestamp === 'string') return timestamp;
  return new Date().toISOString();
}

@Service()
@Meta({ layer: 'plugin', order: 100 })
export class InstanceManager {
  @Inject(SessionStore) private sessionStore!: SessionStore;
  @Inject(EventService) private events!: EventService;
  @Inject(InstanceRepository) private repository!: InstanceRepository;
  @Inject(LoggerService) private log!: LoggerService;

  private instances = new Map<string, BaileysInstance>();
  private metadata = new Map<string, InstanceInfo>();
  private inflightConnects = new Map<string, Promise<void>>();

  /**
   * Build `InstanceInfo` from a persisted row plus a BaileysInstance.
   * Centralized so live and rehydrated instances share one shape.
   */
  private buildInfo(row: PersistedInstance): InstanceInfo {
    return {
      id: row.id,
      name: row.name,
      status: (row.status as InstanceStatus) ?? 'disconnected',
      phone: row.phone ?? undefined,
      profileName: row.profileName ?? undefined,
      lastError: row.lastError ?? undefined,
      autoConnect: row.autoConnect ?? false,
      connectedAt: row.connectedAt ?? undefined,
      lastSeenAt: row.lastSeenAt ?? undefined,
      createdAt: row.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * One registration path for new and restored instances.
   * 1. Build `InstanceInfo` from the persisted row.
   * 2. Create `BaileysInstance`.
   * 3. Attach connection, QR, message, group, and presence listeners once.
   * 4. Insert the live instance and metadata into their maps.
   */
  private register(row: PersistedInstance): InstanceInfo {
    if (this.instances.has(row.id)) {
      throw new Error(`Instance ${row.id} already exists`);
    }

    const info = this.buildInfo(row);
    const instance = new BaileysInstance(row.id, this.sessionStore);

    instance.onEvent('connection_update', (data: any) => {
      const meta = this.metadata.get(row.id);
      if (!meta) return;
      meta.status = data.status;
      if (data.phone !== undefined) meta.phone = data.phone;
      if (data.profileName !== undefined) meta.profileName = data.profileName;
      meta.lastError = this.formatReason(data.reason);
      if (data.status === 'connected') {
        meta.connectedAt = new Date().toISOString();
        meta.qrCode = undefined;
        meta.lastError = undefined;
      }
      // Persist status/phone/profile/error changes; never clear autoConnect here.
      this.repository.updateState(row.id, {
        status: data.status,
        phone: data.phone ?? meta.phone ?? null,
        profileName: data.profileName ?? meta.profileName ?? null,
        connectedAt: data.status === 'connected' ? meta.connectedAt : meta.connectedAt ?? null,
        lastError: meta.lastError ?? null,
      }).catch((err) => this.log?.error?.('instance persist failed', err));

      const connectionPayload = {
        instanceId: row.id,
        status: data.status,
        phone: data.phone,
        profileName: data.profileName,
        reason: data.reason,
      };
      void this.events?.emitAsync?.('whatsapp.connection', connectionPayload)?.catch?.(() => {});
    });

    instance.onEvent('qr', (data: any) => {
      const meta = this.metadata.get(row.id);
      if (meta) meta.qrCode = data.qr;
    });

    instance.onEvent('message', (data: any) => {
      if (data.fromMe) return;
      const payload = {
        mode: 'baileys' as const,
        instanceId: row.id,
        jid: data.from,
        from: data.from,
        fromMe: false,
        text: data.text,
        messageId: data.key?.id ?? '',
        type: data.type ?? 'text',
        timestamp: toIso(data.timestamp),
        raw: data.raw,
      };
      void this.events?.emitAsync?.('whatsapp.message', payload)?.catch?.(() => {});
    });

    instance.onEvent('group', (data: any) => {
      const payload = { instanceId: row.id, ...data };
      void this.events?.emitAsync?.('whatsapp.group', payload)?.catch?.(() => {});
    });

    instance.onEvent('presence', (data: any) => {
      const payload = { instanceId: row.id, ...data };
      void this.events?.emitAsync?.('whatsapp.presence', payload)?.catch?.(() => {});
    });

    instance.onEvent('status', (data: any) => {
      const payload = {
        instanceId: row.id,
        jid: data.jid ?? '',
        from: data.jid ?? '',
        messageId: data.messageId ?? '',
        status: data.status ?? 'unknown',
        timestamp: toIso(data.timestamp),
        raw: data.raw,
      };
      void this.events?.emitAsync?.('whatsapp.status', payload)?.catch?.(() => {});
    });

    this.metadata.set(row.id, info);
    this.instances.set(row.id, instance);
    return info;
  }

  async create(id: string, name: string): Promise<InstanceInfo> {
    if (this.instances.has(id) || this.metadata.has(id)) {
      throw new Error(`Instance ${id} already exists`);
    }
    const row = await this.repository.create({ id, name });
    return this.register(row);
  }

  async connect(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Instance ${id} not found`);

    // Concurrency guard — coalesce overlapping connect calls.
    const existing = this.inflightConnects.get(id);
    if (existing) return existing;

    // Mark operator intent before opening the socket so a crash mid-connect
    // still records the desired auto-reconnect on next boot.
    await this.repository.updateState(id, { autoConnect: true, status: 'connecting' });

    const meta = this.metadata.get(id);
    if (meta) {
      meta.autoConnect = true;
      meta.status = 'connecting';
      meta.lastError = undefined;
    }

    const promise = instance.connect()
      .catch(async (err: any) => {
        const reason = err?.message ?? String(err);
        const meta2 = this.metadata.get(id);
        if (meta2) {
          meta2.status = 'error';
          meta2.lastError = reason;
        }
        await this.repository.updateState(id, { status: 'error', lastError: reason });
        const connectionPayload = {
          instanceId: id,
          status: 'error',
          reason,
        };
        void this.events?.emitAsync?.('whatsapp.connection', connectionPayload)?.catch?.(() => {});
        throw err;
      })
      .finally(() => {
        this.inflightConnects.delete(id);
      });
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
    // Explicit operator disconnect must clear autoConnect so rehydration is a no-op.
    await this.repository.updateState(id, {
      autoConnect: false,
      status: 'disconnected',
      lastError: null,
    });
    if (meta) meta.autoConnect = false;
  }

  async delete(id: string): Promise<void> {
    const instance = this.instances.get(id);
    if (instance) {
      try {
        if (this.metadata.get(id)?.status === 'connected') {
          await instance.logout();
        } else {
          instance.disconnect();
          await this.sessionStore.deleteSession(id);
        }
      } catch (err) {
        this.log?.warn?.(`instance cleanup failed for ${id}`, err);
      }
      this.instances.delete(id);
    }
    this.metadata.delete(id);
    try {
      await this.sessionStore.deleteSession(id);
    } catch {
      // ignore
    }
    try {
      await this.repository.delete(id);
    } catch (err) {
      this.log?.warn?.(`instance row delete failed for ${id}`, err);
    }
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
      meta.autoConnect = true;
    }
    await this.repository.updateState(id, {
      autoConnect: true,
      status: 'connecting',
      lastError: null,
    });

    await this.connect(id);
  }

  async onReady(): Promise<void> {
    const rows = await this.repository.list();
    if (rows.length === 0) return;

    this.log?.info?.(`[najm-whatsapp] rehydrating ${rows.length} instance(s)`);

    const reconnects: Promise<unknown>[] = [];
    for (const row of rows) {
      try {
        this.register(row);
        if (row.autoConnect) {
          const meta = this.metadata.get(row.id)!;
          meta.status = 'connecting';
          reconnects.push(
            this.connect(row.id).catch((err) => {
              this.log?.warn?.(`[najm-whatsapp] reconnect failed for ${row.id}: ${err?.message ?? err}`);
            }),
          );
        }
      } catch (err) {
        this.log?.warn?.(`[najm-whatsapp] failed to rehydrate ${row.id}: ${err?.message ?? err}`);
      }
    }
    await Promise.allSettled(reconnects);
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
