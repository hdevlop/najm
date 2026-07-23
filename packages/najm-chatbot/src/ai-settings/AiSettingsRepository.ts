import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { EncryptionService } from 'najm-auth';
import { desc, eq, sql } from 'drizzle-orm';
import { CHATBOT_SCHEMA } from '../tokens';
import type { LlmProvider } from './AiSettingsDto';

export interface ChatbotSchema {
  aiSettings: any;
  chatSessions?: any;
  chatbotToolEmbeddings?: any;
  chatbotToolSemantics?: any;
  chatbotInteractionLogs?: any;
}

interface ProviderModelStore {
  selected: Partial<Record<LlmProvider, string>>;
  options: Partial<Record<LlmProvider, string[]>>;
}

@Repository()
export class AiSettingsRepository {
  @DB() declare db: any;
  @Inject(CHATBOT_SCHEMA) private schema!: ChatbotSchema;
  private encryption!: EncryptionService;
  private schemaChecked = false;

  setEncryption(encryption: EncryptionService) {
    this.encryption = encryption;
  }

  private get table() {
    return this.schema.aiSettings;
  }

  async get() {
    await this.ensureColumns();
    const t = this.table;
    const [row] = await this.db.select().from(t).orderBy(desc(t.createdAt)).limit(1);
    return row ?? null;
  }

  async create(data: Record<string, any>) {
    await this.ensureColumns();
    const t = this.table;
    const [record] = await this.db.insert(t).values(data).returning();
    return record;
  }

  async update(id: string, data: Record<string, any>) {
    await this.ensureColumns();
    const t = this.table;
    const [record] = await this.db
      .update(t)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(t.id, id))
      .returning();
    return record;
  }

  readProviderKeys(row: any): Partial<Record<LlmProvider, string>> {
    if (!row?.apiKeyEncrypted || !this.encryption) return {};

    try {
      const decrypted = this.encryption.decrypt(row.apiKeyEncrypted);
      const parsed = JSON.parse(decrypted) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Partial<Record<LlmProvider, string>>;
      }
      return row.provider ? { [row.provider]: decrypted } : {};
    } catch {
      try {
        return row.provider ? { [row.provider]: this.encryption.decrypt(row.apiKeyEncrypted) } : {};
      } catch {
        return {};
      }
    }
  }

  encryptProviderKeys(keys: Partial<Record<LlmProvider, string>>) {
    const normalized = Object.fromEntries(
      Object.entries(keys).filter(([, value]) => typeof value === 'string' && value.trim()),
    );
    return Object.keys(normalized).length > 0
      ? this.encryption.encrypt(JSON.stringify(normalized))
      : null;
  }

  readProviderModelStore(row: any): ProviderModelStore {
    if (!row?.model) return { selected: {}, options: {} };

    try {
      const parsed = JSON.parse(row.model) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if ('selected' in record || 'options' in record) {
          return {
            selected: this.normalizeProviderModels(record.selected),
            options: this.normalizeProviderModelOptions(record.options),
          };
        }
        return {
          selected: this.normalizeProviderModels(parsed),
          options: {},
        };
      }
      return row.provider ? { selected: { [row.provider]: row.model }, options: {} } : { selected: {}, options: {} };
    } catch {
      return row.provider ? { selected: { [row.provider]: row.model }, options: {} } : { selected: {}, options: {} };
    }
  }

  readProviderModels(row: any): Partial<Record<LlmProvider, string>> {
    return this.readProviderModelStore(row).selected;
  }

  readProviderModelOptions(row: any): Partial<Record<LlmProvider, string[]>> {
    return this.readProviderModelStore(row).options;
  }

  serializeProviderModels(
    models: Partial<Record<LlmProvider, string>>,
    provider: LlmProvider,
    options: Partial<Record<LlmProvider, string[]>> = {},
  ) {
    const selected = this.normalizeProviderModels(models);
    const normalizedOptions = this.normalizeProviderModelOptions(options);
    const hasOptions = Object.values(normalizedOptions).some((items) => items.length > 0);

    if (!hasOptions && Object.keys(selected).length <= 1) {
      return selected[provider] ?? Object.values(selected)[0] ?? 'llama3.1';
    }
    return JSON.stringify({ selected, options: normalizedOptions });
  }

  toPublic(row: any) {
    if (!row) return null;
    const { apiKeyEncrypted, ...rest } = row;
    const providerKeys = this.readProviderKeys(row);
    const modelStore = this.readProviderModelStore(row);
    const providerModels = modelStore.selected;
    const providerKeyFlags = Object.fromEntries(
      Object.entries(providerKeys).map(([provider, key]) => [provider, Boolean(key)]),
    );
    const provider = row.provider as LlmProvider;
    return {
      ...rest,
      model: providerModels[provider] ?? row.model,
      hasKey: Boolean(row.provider && providerKeys[provider]),
      providerKeys: providerKeyFlags,
      providerModels,
      providerModelOptions: modelStore.options,
    };
  }

  decryptApiKey(row: any): any {
    const providerKeys = this.readProviderKeys(row);
    const modelStore = this.readProviderModelStore(row);
    const providerModels = modelStore.selected;
    const provider = row?.provider as LlmProvider;
    return {
      ...row,
      model: providerModels[provider] ?? row?.model,
      apiKey: providerKeys[provider] ?? null,
      providerKeys,
      providerModels,
      providerModelOptions: modelStore.options,
    };
  }

  private async ensureColumns(): Promise<void> {
    if (this.schemaChecked) return;
    this.schemaChecked = true;

    if (typeof this.db.all === 'function') {
      const columns = await this.db.all(sql`PRAGMA table_info(ai_settings)`);
      const list = Array.isArray(columns) ? columns : columns?.rows ?? [];
      if (list.length === 0) return;
      if (!list.some((column: any) => column.name === 'use_memory')) {
        await this.db.run(sql`ALTER TABLE ai_settings ADD COLUMN use_memory INTEGER NOT NULL DEFAULT 1`);
      }
      if (!list.some((column: any) => column.name === 'max_stored_messages')) {
        await this.db.run(sql`ALTER TABLE ai_settings ADD COLUMN max_stored_messages INTEGER DEFAULT 100`);
      }
      if (!list.some((column: any) => column.name === 'max_prompt_messages')) {
        await this.db.run(sql`ALTER TABLE ai_settings ADD COLUMN max_prompt_messages INTEGER DEFAULT 10`);
      }
      return;
    }

    if (typeof this.db.execute === 'function') {
      await this.db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS use_memory boolean NOT NULL DEFAULT true
      `);
      await this.db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS max_stored_messages integer DEFAULT 100
      `);
      await this.db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS max_prompt_messages integer DEFAULT 10
      `);
    }
  }

  private normalizeProviderModels(value: unknown): Partial<Record<LlmProvider, string>> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, model]) => typeof model === 'string' && model.trim())
        .map(([provider, model]) => [provider, String(model).trim()]),
    ) as Partial<Record<LlmProvider, string>>;
  }

  private normalizeProviderModelOptions(value: unknown): Partial<Record<LlmProvider, string[]>> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([provider, models]) => [
        provider,
        Array.isArray(models)
          ? [...new Set(models.filter((model) => typeof model === 'string' && model.trim()).map((model) => model.trim()))]
          : [],
      ]),
    ) as Partial<Record<LlmProvider, string[]>>;
  }
}
