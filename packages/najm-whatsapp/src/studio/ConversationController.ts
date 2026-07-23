import { Controller, Get, Params, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { isAdmin } from 'najm-auth';
import { desc, eq } from 'drizzle-orm';
import { WA_SCHEMA } from '../tokens';

@Controller('/wa-studio/conversations')
@isAdmin()
export class ConversationController {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;

  @Get('/:instanceId')
  async list(@Params('instanceId') instanceId: string) {
    const chats = this.schema.whatsappChats;
    return this.db
      .select()
      .from(chats)
      .where(eq(chats.instanceId, instanceId))
      .orderBy(desc(chats.lastMessageAt));
  }
}
