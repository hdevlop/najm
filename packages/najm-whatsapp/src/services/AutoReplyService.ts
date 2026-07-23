import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { On } from 'najm-event';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { InstanceManager } from '../engine/InstanceManager';
import { MessageService } from '../engine/MessageService';
import { AiResponderService } from './AiResponderService';
import { AutoReplyMatcher, CompiledRule } from './AutoReplyMatcher';
import { WHATSAPP_EVENTS, type WhatsAppMessageEvent } from '../events';
import type { WhatsAppAutoReplyRule } from '../schema/sqlite';

interface RuleRow {
  id: string;
  pattern: string;
  response: string;
  matchType: 'exact' | 'prefix' | 'regex';
  enabled: boolean;
}

@Service()
@Meta({ layer: 'plugin' })
export class AutoReplyService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageService) private messages!: MessageService;
  @Inject(AiResponderService) private ai!: AiResponderService;
  @Inject(LoggerService) private log?: LoggerService;

  private compiled = new Map<string, CompiledRule[]>();
  private ruleRows = new Map<string, RuleRow[]>();

  async listRules(instanceId: string): Promise<WhatsAppAutoReplyRule[]> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) return [];
    return this.db
      .select()
      .from(table)
      .where(eq(table.instanceId, instanceId))
      .orderBy(table.createdAt);
  }

  private loadRules(instanceId: string): RuleRow[] {
    const cached = this.ruleRows.get(instanceId);
    if (cached) return cached;
    return [];
  }

  private async ensureRulesLoaded(instanceId: string): Promise<RuleRow[]> {
    if (this.ruleRows.has(instanceId)) {
      return this.ruleRows.get(instanceId)!;
    }
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) {
      this.ruleRows.set(instanceId, []);
      return [];
    }
    const rows = await this.db
      .select()
      .from(table)
      .where(eq(table.instanceId, instanceId))
      .orderBy(table.createdAt);
    this.ruleRows.set(instanceId, rows as RuleRow[]);
    return rows as RuleRow[];
  }

  private async rebuildCache(instanceId: string): Promise<CompiledRule[]> {
    const rows = await this.ensureRulesLoaded(instanceId);
    const compiled: CompiledRule[] = [];
    for (const r of rows) {
      if (!r.enabled) continue;
      try {
        const matcher = AutoReplyMatcher.compile({ pattern: r.pattern, matchType: r.matchType });
        compiled.push({ id: r.id, enabled: true, response: r.response, matcher });
      } catch (err: any) {
        this.log?.warn?.(`[najm-whatsapp] skip invalid auto-reply rule ${r.id}: ${err?.message ?? err}`);
      }
    }
    this.compiled.set(instanceId, compiled);
    return compiled;
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

    // Compile-time validation so bad patterns are rejected before persist.
    AutoReplyMatcher.validate(data.pattern, data.matchType);

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
    this.ruleRows.delete(data.instanceId);
    this.compiled.delete(data.instanceId);
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
    if (data.pattern !== undefined && data.matchType !== undefined) {
      AutoReplyMatcher.validate(data.pattern, data.matchType);
    } else if (data.pattern !== undefined || data.matchType !== undefined) {
      // Need the existing matchType to validate a new pattern.
      const existing = await this.db
        .select()
        .from(table)
        .where(and(eq(table.instanceId, instanceId), eq(table.id, id)))
        .limit(1);
      const mt = (data.matchType ?? existing[0]?.matchType ?? 'exact') as 'exact' | 'prefix' | 'regex';
      const p = data.pattern ?? existing[0]?.pattern;
      if (p) AutoReplyMatcher.validate(p, mt);
    }
    await this.db
      .update(table)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)));
    const rows = await this.db
      .select()
      .from(table)
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)))
      .limit(1);
    this.ruleRows.delete(instanceId);
    this.compiled.delete(instanceId);
    return rows[0];
  }

  async deleteRule(instanceId: string, id: string): Promise<void> {
    const table = this.schema.whatsappAutoReplyRules;
    if (!table) return;
    await this.db
      .delete(table)
      .where(and(eq(table.instanceId, instanceId), eq(table.id, id)));
    this.ruleRows.delete(instanceId);
    this.compiled.delete(instanceId);
  }

  async matchAndReply(instanceId: string, text: string, jid: string): Promise<boolean> {
    let rules = this.compiled.get(instanceId);
    if (!rules) rules = await this.rebuildCache(instanceId);
    for (const rule of rules) {
      if (AutoReplyMatcher.test(rule.matcher, text)) {
        try {
          await this.messages.sendText(instanceId, jid, rule.response);
          return true;
        } catch (err: any) {
          this.log?.warn?.(`[najm-whatsapp] auto-reply send failed: ${err?.message ?? err}`);
        }
      }
    }
    return false;
  }

  @On(WHATSAPP_EVENTS.message)
  async handleIncomingMessage(data: WhatsAppMessageEvent): Promise<void> {
    const instanceId = data?.instanceId;
    const text = data?.text ?? '';
    const jid = data?.jid ?? data?.from ?? '';
    if (!text || !jid || !instanceId) return;

    const replied = await this.matchAndReply(instanceId, text, jid);
    if (!replied) {
      try {
        await this.ai.respond(instanceId, text, jid);
      } catch (err: any) {
        this.log?.warn?.(`[najm-whatsapp] AI responder failed: ${err?.message ?? err}`);
      }
    }
  }
}
