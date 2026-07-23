import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { InstanceManager } from '../engine/InstanceManager';
import { WA_SCHEMA } from '../tokens';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface SyncContactInput {
  jid: string;
  phone?: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
  isBusiness?: boolean;
  labels?: any;
  lastMessageAt?: string;
}

@Service()
@Meta({ layer: 'plugin' })
export class ContactService {
  @Inject(InstanceManager) private instances!: InstanceManager;
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  async addOrEdit(instanceId: string, jid: string, contact: any) {
    const adapter = this.instances.getInstance(instanceId).getAdapter();
    return adapter.addOrEditContact(jid, contact);
  }

  async list(instanceId: string, limit = 50, offset = 0) {
    const contacts = this.schema.whatsappContacts;
    return this.db
      .select()
      .from(contacts)
      .where(eq(contacts.instanceId, instanceId))
      .limit(limit)
      .offset(offset);
  }

  async sync(instanceId: string, contacts: SyncContactInput[]) {
    const table = this.schema.whatsappContacts;
    for (const c of contacts) {
      await this.db.insert(table).values({
        id: randomUUID(),
        instanceId,
        jid: c.jid,
        phone: c.phone,
        name: c.name,
        pushName: c.pushName,
        profilePictureUrl: c.profilePictureUrl,
        isBusiness: c.isBusiness,
        labels: c.labels != null ? JSON.stringify(c.labels) : undefined,
        lastMessageAt: c.lastMessageAt,
      }).onConflictDoUpdate({
        target: [table.instanceId, table.jid],
        set: {
          phone: c.phone,
          name: c.name,
          pushName: c.pushName,
          profilePictureUrl: c.profilePictureUrl,
          isBusiness: c.isBusiness,
          labels: c.labels != null ? JSON.stringify(c.labels) : undefined,
          lastMessageAt: c.lastMessageAt,
        },
      });
    }
  }
}
