import { eq } from 'drizzle-orm';
import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { CacheService } from 'najm-cache';
import { DB } from 'najm-database';
import { WA_SCHEMA } from '../tokens';
import { MessageService } from '../engine/MessageService';
import { AI_DEFAULT_LIMITS, type AiLimits } from '../dto/ai-config.dto';
import type { WhatsAppAiConfig } from '../schema/sqlite';

interface HydratedConfig extends Omit<WhatsAppAiConfig, 'limits'> {
  limits: AiLimits;
}

interface ProviderCallOptions {
  timeoutMs: number;
}

const SAFE_NAME_MAX = 200;

function safeName(name: string): string {
  if (name.length > SAFE_NAME_MAX) return name.slice(0, SAFE_NAME_MAX);
  return name;
}

@Service()
@Meta({ layer: 'plugin' })
export class AiResponderService {
  @DB() private db!: any;
  @Inject(WA_SCHEMA) private schema!: any;
  @Inject(MessageService) private messages!: MessageService;
  @Inject(CacheService) private cache!: CacheService;
  @Inject(LoggerService) private log!: LoggerService;

  private configCache = new Map<string, { value: HydratedConfig | null; ts: number }>();
  private static CACHE_TTL_MS = 30_000;

  async getConfig(instanceId: string): Promise<WhatsAppAiConfig | null> {
    const table = this.schema.whatsappAiConfigs;
    if (!table) return null;
    const rows = await this.db.select().from(table).where(eq(table.instanceId, instanceId)).limit(1);
    return rows[0] ?? null;
  }

  async getHydratedConfig(instanceId: string): Promise<HydratedConfig | null> {
    const cached = this.configCache.get(instanceId);
    if (cached && Date.now() - cached.ts < AiResponderService.CACHE_TTL_MS) {
      return cached.value;
    }
    const row = await this.getConfig(instanceId);
    const value = row ? this.hydrate(row) : null;
    this.configCache.set(instanceId, { value, ts: Date.now() });
    return value;
  }

  private hydrate(row: WhatsAppAiConfig): HydratedConfig {
    const limits = this.parseLimits(row.limits);
    return { ...row, limits: { ...AI_DEFAULT_LIMITS, ...limits } };
  }

  private parseLimits(raw: string | null | undefined): Partial<AiLimits> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Partial<AiLimits>;
    } catch {
      // ignore corrupt row
    }
    return {};
  }

  private serializeLimits(limits: Partial<AiLimits> | undefined): string | null {
    if (!limits) return null;
    return JSON.stringify({ ...AI_DEFAULT_LIMITS, ...limits });
  }

  invalidateCache(instanceId: string): void {
    this.configCache.delete(instanceId);
  }

  async upsertConfig(data: {
    instanceId: string;
    enabled: boolean;
    provider?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    limits?: Partial<AiLimits>;
  }): Promise<WhatsAppAiConfig> {
    const table = this.schema.whatsappAiConfigs;
    if (!table) throw new Error('AI config schema not available');

    const existing = await this.getConfig(data.instanceId);
    const temperature = typeof data.temperature === 'number' ? String(data.temperature) : data.temperature;
    const limitsJson = this.serializeLimits(data.limits);

    if (existing) {
      await this.db
        .update(table)
        .set({
          enabled: data.enabled,
          provider: data.provider ?? existing.provider,
          model: data.model ?? existing.model,
          systemPrompt: data.systemPrompt ?? existing.systemPrompt,
          temperature: temperature ?? existing.temperature,
          limits: limitsJson ?? existing.limits ?? null,
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
        limits: limitsJson,
      });
    }

    this.invalidateCache(data.instanceId);
    const rows = await this.db.select().from(table).where(eq(table.instanceId, data.instanceId)).limit(1);
    return rows[0];
  }

  async respond(instanceId: string, text: string, jid: string): Promise<boolean> {
    const config = await this.getHydratedConfig(instanceId);
    if (!config || !config.enabled) return false;

    const apiKey = this.resolveApiKey(config.provider);
    if (!apiKey) {
      this.log?.debug?.(`[najm-whatsapp] AI skipped: no API key for ${config.provider ?? 'unknown'}`);
      return false;
    }

    // Enforce per-minute and per-day rate limits before any provider call.
    const within = await this.consumeQuota(instanceId, config.limits);
    if (within.ok === false) {
      const reason = (within as { ok: false; reason: string }).reason;
      this.log?.info?.(`[najm-whatsapp] AI throttled: ${instanceId} (${reason})`);
      return false;
    }

    const truncated = this.truncateInput(text, config.limits.maxInputChars);

    try {
      const reply = await this.callProvider(config, truncated, apiKey, { timeoutMs: config.limits.timeoutMs });
      if (reply) {
        await this.messages.sendText(instanceId, jid, reply);
        return true;
      }
    } catch (err: any) {
      this.log?.warn?.(`[najm-whatsapp] AI provider error: ${err?.class ?? 'unknown'} (${err?.status ?? '-'})`);
    }
    return false;
  }

  private async consumeQuota(instanceId: string, limits: AiLimits): Promise<{ ok: true } | { ok: false; reason: string }> {
    const minuteKey = `wa:ai:rate:${instanceId}:${Math.floor(Date.now() / 60_000)}`;
    const dayKey = `wa:ai:rate:${instanceId}:${new Date().toISOString().slice(0, 10)}`;
    const minute = await this.cache.incr(minuteKey, 90_000);
    if (minute.count > limits.requestsPerMinute) {
      return { ok: false, reason: 'minute' };
    }
    const day = await this.cache.incr(dayKey, this.msUntilEndOfDay());
    if (day.count > limits.requestsPerDay) {
      return { ok: false, reason: 'day' };
    }
    return { ok: true };
  }

  private msUntilEndOfDay(): number {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    return Math.max(60_000, end.getTime() - now.getTime());
  }

  private truncateInput(text: string, max: number): string {
    if (!text) return '';
    if (text.length <= max) return text;
    return text.slice(0, max);
  }

  private resolveApiKey(provider?: string): string | undefined {
    if (provider === 'openai') return process.env.OPENAI_API_KEY;
    if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
    return undefined;
  }

  private async callProvider(
    config: HydratedConfig,
    text: string,
    apiKey: string,
    opts: ProviderCallOptions,
  ): Promise<string | null> {
    const provider = config.provider || 'openai';
    const model = config.model || (provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini');
    const system = config.systemPrompt || 'You are a helpful assistant.';
    const temp = Number(config.temperature ?? 0.7);
    const safeModel = safeName(model);

    if (provider === 'openai') {
      return this.callOpenAI(safeModel, system, text, temp, apiKey, opts.timeoutMs);
    }
    if (provider === 'anthropic') {
      return this.callAnthropic(safeModel, system, text, temp, apiKey, opts.timeoutMs);
    }
    this.log?.warn?.(`[najm-whatsapp] unknown AI provider: ${safeName(provider)}`);
    return null;
  }

  private async callOpenAI(
    model: string,
    system: string,
    text: string,
    temperature: number,
    apiKey: string,
    timeoutMs: number,
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
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw this.providerError('openai', res.status);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  }

  private async callAnthropic(
    model: string,
    system: string,
    text: string,
    temperature: number,
    apiKey: string,
    timeoutMs: number,
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
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw this.providerError('anthropic', res.status);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? null;
  }

  private providerError(provider: string, status: number) {
    const err: any = new Error(`${provider} returned ${status}`);
    err.class = status >= 500 ? '5xx' : status === 429 ? 'rate_limited' : '4xx';
    err.status = status;
    return err;
  }
}
