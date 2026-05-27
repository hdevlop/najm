import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { InstanceManager } from '../engine/InstanceManager';
import { WA_SCHEMA } from '../tokens';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

@Service()
@Meta({ layer: 'plugin' })
export class LabelService {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  async addChatLabel(instanceId: string, jid: string, labelId: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.addChatLabel(jid, labelId);
  }

  async removeChatLabel(instanceId: string, jid: string, labelId: string) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.removeChatLabel(jid, labelId);
  }

  async addLabel(instanceId: string, jid: string, labels: any) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.addLabel(jid, labels);
  }

  async list(instanceId: string) {
    const t = this.schema.whatsappLabels;
    return this.db.select().from(t).where(eq(t.instanceId, instanceId));
  }

  async create(instanceId: string, name: string, color: string) {
    const t = this.schema.whatsappLabels;
    const id = randomUUID();
    await this.db.insert(t).values({ id, instanceId, name, color, predefined: false });
    const rows = await this.db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0];
  }

  async delete(instanceId: string, labelId: string) {
    const t = this.schema.whatsappLabels;
    await this.db.delete(t).where(and(eq(t.instanceId, instanceId), eq(t.id, labelId)));
  }

  async update(instanceId: string, labelId: string, data: { name?: string; color?: string }) {
    const t = this.schema.whatsappLabels;
    await this.db
      .update(t)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(t.instanceId, instanceId), eq(t.id, labelId)));
    const rows = await this.db.select().from(t).where(eq(t.id, labelId)).limit(1);
    return rows[0];
  }
}
