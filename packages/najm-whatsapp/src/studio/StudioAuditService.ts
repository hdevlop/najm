import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { eq, desc, and } from 'drizzle-orm';

@Service()
@Meta({ layer: 'plugin' })
export class StudioAuditService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  /**
   * Fire-and-forget audit log. Returns immediately; DB errors are swallowed and
   * logged to the console so a slow/failing audit table never stalls controllers.
   */
  log(action: string, details: { instanceId?: string; userId?: string; [k: string]: any }): Promise<void> {
    const t = this.schema.whatsappStudioAuditLogs;
    const insert = this.db.insert(t).values({
      action,
      instanceId: details.instanceId ?? null,
      userId: details.userId ?? null,
      details: JSON.stringify(details),
    });
    // Detach the promise; surface failures without re-throwing.
    Promise.resolve(insert).catch((err: unknown) => {
      console.error('[StudioAuditService] audit insert failed:', err);
    });
    return Promise.resolve();
  }

  async list(limit = 100, offset = 0, filter?: { instanceId?: string; userId?: string }) {
    const t = this.schema.whatsappStudioAuditLogs;
    const conditions = [];
    if (filter?.instanceId) conditions.push(eq(t.instanceId, filter.instanceId));
    if (filter?.userId) conditions.push(eq(t.userId, filter.userId));

    const base = this.db.select().from(t);
    const filtered = conditions.length > 0
      ? base.where(and(...conditions))
      : base;

    return filtered.orderBy(desc(t.createdAt)).limit(limit).offset(offset);
  }
}
