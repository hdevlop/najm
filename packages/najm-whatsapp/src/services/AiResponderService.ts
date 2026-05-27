import { eq } from 'drizzle-orm';
import { Service, Meta, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { InstanceManager } from '../engine/InstanceManager';
import { MessageService } from '../engine/MessageService';
import type { WhatsAppAiConfig } from '../schema/sqlite';

@Service()
@Meta({ layer: 'plugin' })
export class AiResponderService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;
  @Inject(InstanceManager) private instances!: InstanceManager;
  @Inject(MessageService) private messages!: MessageService;

  async getConfig(instanceId: string): Promise<WhatsAppAiConfig | null> {
    const table = this.schema.whatsappAiConfigs;
    if (!table) return null;
    const rows = await this.db.select().from(table).where(eq(table.instanceId, instanceId)).limit(1);
    return rows[0] ?? null;
  }

  async upsertConfig(data: {
    instanceId: string;
    enabled: boolean;
    provider?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<WhatsAppAiConfig> {
    const table = this.schema.whatsappAiConfigs;
    if (!table) throw new Error('AI config schema not available');

    const existing = await this.getConfig(data.instanceId);
    const temperature = typeof data.temperature === 'number' ? String(data.temperature) : data.temperature;

    if (existing) {
      await this.db
        .update(table)
        .set({
          enabled: data.enabled,
          provider: data.provider ?? existing.provider,
          model: data.model ?? existing.model,
          systemPrompt: data.systemPrompt ?? existing.systemPrompt,
          temperature: temperature ?? existing.temperature,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(table.instanceId, data.instanceId));
    } else {
      await this.db.insert(table).values({
        instanceId: data.instanceId,
        enabled: data.enabled,
        provider: data.provider,
        model: data.model,
        systemPrompt: data.systemPrompt,
        temperature,
      });
    }

    const rows = await this.db.select().from(table).where(eq(table.instanceId, data.instanceId)).limit(1);
    return rows[0];
  }

  async respond(instanceId: string, text: string, jid: string): Promise<boolean> {
    const config = await this.getConfig(instanceId);
    if (!config || !config.enabled) return false;

    const apiKey = this.resolveApiKey(config.provider);
    if (!apiKey) return false;

    try {
      const reply = await this.callProvider(config, text, apiKey);
      if (reply) {
        await this.messages.sendText(instanceId, jid, reply);
        return true;
      }
    } catch {
      // Silently fail on AI errors
    }
    return false;
  }

  private resolveApiKey(provider?: string): string | undefined {
    if (provider === 'openai') return process.env.OPENAI_API_KEY;
    if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
    return undefined;
  }

  private async callProvider(config: WhatsAppAiConfig, text: string, apiKey: string): Promise<string | null> {
    const provider = config.provider || 'openai';
    const model = config.model || 'gpt-4o-mini';
    const system = config.systemPrompt || 'You are a helpful assistant.';
    const temp = Number(config.temperature ?? 0.7);

    if (provider === 'openai') {
      return this.callOpenAI(model, system, text, temp, apiKey);
    }
    if (provider === 'anthropic') {
      return this.callAnthropic(model, system, text, temp, apiKey);
    }
    return null;
  }

  private async callOpenAI(
    model: string,
    system: string,
    text: string,
    temperature: number,
    apiKey: string,
  ): Promise<string | null> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        temperature,
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  }

  private async callAnthropic(
    model: string,
    system: string,
    text: string,
    temperature: number,
    apiKey: string,
  ): Promise<string | null> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text ?? null;
  }
}
