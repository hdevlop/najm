/**
 * InstanceRepository — owns all database access for `whatsapp_instances`.
 *
 * Persistence is split out from `InstanceManager` so the manager can focus on
 * in-memory state and the repository can be unit-tested without sockets.
 *
 * A persisted row carries:
 *   - operator intent (`autoConnect`) — true when the operator wants the
 *     instance to reconnect on restart
 *   - observed status (`status`) — what Baileys is currently doing, including
 *     transient disconnects that the manager will reconnect through
 *   - `lastError` — formatted last-disconnect reason
 */
import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { eq } from 'drizzle-orm';
import type { WhatsAppInstance } from '../schema/sqlite';

export type PersistedInstance = WhatsAppInstance;

export interface NewInstance {
  id: string;
  name: string;
  autoConnect?: boolean;
}

export interface InstanceStatePatch {
  status?: string;
  phone?: string | null;
  profileName?: string | null;
  connectedAt?: string | null;
  lastSeenAt?: string | null;
  autoConnect?: boolean;
  lastError?: string | null;
}

@Service()
@Meta({ layer: 'plugin' })
export class InstanceRepository {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  private get table() {
    return this.schema.whatsappInstances;
  }

  async list(): Promise<PersistedInstance[]> {
    if (!this.table) return [];
    return this.db.select().from(this.table);
  }

  async findById(id: string): Promise<PersistedInstance | null> {
    if (!this.table) return null;
    const rows = await this.db.select().from(this.table).where(eq(this.table.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(row: NewInstance): Promise<PersistedInstance> {
    const now = new Date().toISOString();
    const id = row.id;
    const values: any = {
      id,
      name: row.name,
      status: 'disconnected',
      autoConnect: row.autoConnect ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(this.table).values(values);
    const created = await this.findById(id);
    if (!created) throw new Error('Failed to load newly created instance');
    return created;
  }

  async updateState(id: string, patch: InstanceStatePatch): Promise<void> {
    if (!this.table) return;
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.phone !== undefined) updates.phone = patch.phone;
    if (patch.profileName !== undefined) updates.profileName = patch.profileName;
    if (patch.connectedAt !== undefined) updates.connectedAt = patch.connectedAt;
    if (patch.lastSeenAt !== undefined) updates.lastSeenAt = patch.lastSeenAt;
    if (patch.autoConnect !== undefined) updates.autoConnect = patch.autoConnect;
    if (patch.lastError !== undefined) updates.lastError = patch.lastError;
    if (Object.keys(updates).length === 1) return; // only updatedAt
    await this.db.update(this.table).set(updates).where(eq(this.table.id, id));
  }

  async delete(id: string): Promise<void> {
    if (!this.table) return;
    await this.db.delete(this.table).where(eq(this.table.id, id));
  }
}
