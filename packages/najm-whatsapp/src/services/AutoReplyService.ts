import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { Service, Meta, Inject } from 'najm-core';
import { On } from 'najm-event';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { InstanceManager } from '../engine/InstanceManager';
import { MessageService } from '../engine/MessageService';
import { AiResponderService } from './AiResponderService';
import type { WhatsAppAutoReplyRule } from '../schema/sqlite';

@Service()
@Meta({ layer: 'plugin' })
export class AutoReplyService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageService) private messages!: MessageService;
  @Inject(AiResponderService) private ai!: AiResponderService;

  async listRules(instanceId: string): Promise<WhatsAppAutoReplyRule[]> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) return [];
    return this.db
      .select()
      .from(table)
      .where(eq(table.instanceId, instanceId))
      .orderBy(table.createdAt);
  }

  async createRule(data: {
    instanceId: string;
    pattern: string;
    response: string;
    matchType: 'exact' | 'prefix' | 'regex';
    enabled?: boolean;
  }): Promise<WhatsAppAutoReplyRule> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) throw new Error('Auto-reply schema not available');
    const id = randomUUID();
    await this.db.insert(table).values({
      id,
      instanceId: data.instanceId,
      pattern: data.pattern,
      response: data.response,
      matchType: data.matchType,
      enabled: data.enabled ?? true,
    });
    const rows = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return rows[0];
  }

  async updateRule(
    instanceId: string,
    id: string,
    data: Partial<{
      pattern: string;
      response: string;
      matchType: 'exact' | 'prefix' | 'regex';
      enabled: boolean;
    }>,
  ): Promise<WhatsAppAutoReplyRule> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) throw new Error('Auto-reply schema not available');
    await this.db
      .update(table)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)));
    const rows = await this.db
      .select()
      .from(table)
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)))
      .limit(1);
    return rows[0];
  }

  async deleteRule(instanceId: string, id: string): Promise<void> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) return;
    await this.db
      .delete(table)
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)));
  }

  async matchAndReply(instanceId: string, text: string, jid: string): Promise<boolean> {
    const rules = await this.listRules(instanceId);
    const activeRules = rules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      if (this.matches(rule.pattern, rule.matchType, text)) {
        try {
          await this.messages.sendText(instanceId, jid, rule.response);
          return true;
        } catch {
          // Silently fail on auto-reply send errors
        }
      }
    }
    return false;
  }

  @On('whatsapp.message')
  async handleIncomingMessage(data: any): Promise<void> {
    const { instanceId, text, jid } = data;
    if (!text || !jid || !instanceId) return;

    const replied = await this.matchAndReply(instanceId, text, jid);
    if (!replied) {
      await this.ai.respond(instanceId, text, jid);
    }
  }

  private matches(pattern: string, matchType: string, text: string): boolean {
    const t = text.trim();
    const p = pattern.trim();
    if (!t || !p) return false;

    switch (matchType) {
      case 'exact':
        return t.toLowerCase() === p.toLowerCase();
      case 'prefix':
        return t.toLowerCase().startsWith(p.toLowerCase());
      case 'regex':
        try {
          return new RegExp(p, 'i').test(t);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
