import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { eq, and, desc, asc } from 'drizzle-orm';

export interface SaveMessageInput {
  direction: 'inbound' | 'outbound';
  jid: string;
  fromMe: boolean;
  type: string;
  content?: any;
  waMessageId?: string;
  quotedId?: string;
  status?: string;
  metadata?: any;
  timestamp: string;
}

@Service()
@Meta({ layer: 'plugin' })
export class MessageStoreService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  async saveMessage(instanceId: string, msg: SaveMessageInput) {
    const messages = this.schema.whatsappMessages;

    // Dedup: Baileys re-fires the same message (notify + append). Skip if
    // we already stored this waMessageId for this instance.
    if (msg.waMessageId) {
      const existing = await this.db
        .select({ id: messages.id })
        .from(messages)
        .where(and(
          eq(messages.instanceId, instanceId),
          eq(messages.waMessageId, msg.waMessageId),
        ))
        .limit(1);
      if (existing.length > 0) return;
    }

    await this.db.insert(messages).values({
      instanceId,
      direction: msg.direction,
      jid: msg.jid,
      fromMe: msg.fromMe,
      type: msg.type,
      content: msg.content != null ? JSON.stringify(msg.content) : undefined,
      waMessageId: msg.waMessageId,
      quotedId: msg.quotedId,
      status: msg.status,
      metadata: msg.metadata != null ? JSON.stringify(msg.metadata) : undefined,
      timestamp: msg.timestamp,
    });
  }

  async getMessages(instanceId: string, jid: string, limit = 50, offset = 0) {
    const messages = this.schema.whatsappMessages;
    return this.db
      .select()
      .from(messages)
      .where(and(eq(messages.instanceId, instanceId), eq(messages.jid, jid)))
      .orderBy(desc(messages.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getOldestMessage(instanceId: string, jid: string) {
    const messages = this.schema.whatsappMessages;
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.instanceId, instanceId), eq(messages.jid, jid)))
      .orderBy(asc(messages.timestamp))
      .limit(1);
    return rows[0] ?? null;
  }
}
