/**
 * WebhookService — CRUD for dynamic webhook subscribers stored in the DB.
 * The forwarder reads from this service to determine where events should be sent.
 */
import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface WebhookRecord {
  id: string;
  instanceId: string | null;
  url: string;
  events: string[] | null;
  headers: Record<string, string> | null;
  enabled: boolean;
  signingSecret: string | null;
}

interface DbRow {
  id: string;
  instanceId: string | null;
  url: string;
  events: string | null;
  headers: string | null;
  enabled: boolean;
  signingSecret: string | null;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function hydrate(row: DbRow): WebhookRecord {
  return {
    id: row.id,
    instanceId: row.instanceId,
    url: row.url,
    events: parseJson<string[]>(row.events),
    headers: parseJson<Record<string, string>>(row.headers),
    enabled: row.enabled,
    signingSecret: row.signingSecret ?? null,
  };
}

@Service()
@Meta({ layer: 'plugin' })
export class WebhookService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  async list(instanceId?: string): Promise<WebhookRecord[]> {
    const t = this.schema.whatsappWebhooks;
    const rows: DbRow[] = instanceId
      ? await this.db.select().from(t).where(eq(t.instanceId, instanceId))
      : await this.db.select().from(t);
    return rows.map(hydrate);
  }

  async listForEvent(eventType: string, instanceId?: string): Promise<WebhookRecord[]> {
    const all = await this.list();
    return all.filter((w) => {
      if (!w.enabled) return false;
      if (w.instanceId && instanceId && w.instanceId !== instanceId) return false;
      if (w.events && w.events.length > 0 && !w.events.includes(eventType)) return false;
      return true;
    });
  }

  async create(input: {
    url: string;
    events?: string[];
    headers?: Record<string, string>;
    instanceId?: string;
    enabled?: boolean;
    signingSecret?: string;
  }): Promise<WebhookRecord> {
    const t = this.schema.whatsappWebhooks;
    const id = randomUUID();
    await this.db.insert(t).values({
      id,
      instanceId: input.instanceId ?? null,
      url: input.url,
      events: input.events ? JSON.stringify(input.events) : null,
      headers: input.headers ? JSON.stringify(input.headers) : null,
      enabled: input.enabled ?? true,
      signingSecret: input.signingSecret ?? null,
    });
    const rows: DbRow[] = await this.db.select().from(t).where(eq(t.id, id)).limit(1);
    return hydrate(rows[0]);
  }

  async update(
    id: string,
    patch: {
      url?: string;
      events?: string[];
      headers?: Record<string, string>;
      instanceId?: string | null;
      enabled?: boolean;
      signingSecret?: string | null;
    },
  ): Promise<WebhookRecord | null> {
    const t = this.schema.whatsappWebhooks;
    const updates: Record<string, any> = {};
    if (patch.url !== undefined) updates.url = patch.url;
    if (patch.events !== undefined) updates.events = JSON.stringify(patch.events);
    if (patch.headers !== undefined) updates.headers = JSON.stringify(patch.headers);
    if (patch.instanceId !== undefined) updates.instanceId = patch.instanceId;
    if (patch.enabled !== undefined) updates.enabled = patch.enabled;
    if (patch.signingSecret !== undefined) updates.signingSecret = patch.signingSecret;
    if (Object.keys(updates).length === 0) {
      const rows: DbRow[] = await this.db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? hydrate(rows[0]) : null;
    }
    await this.db.update(t).set(updates).where(eq(t.id, id));
    const rows: DbRow[] = await this.db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0] ? hydrate(rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    const t = this.schema.whatsappWebhooks;
    await this.db.delete(t).where(eq(t.id, id));
  }
}
