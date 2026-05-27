import { Service } from 'najm-core';
import { EncryptionService } from 'najm-auth';
import { AiSettingsRepository } from './AiSettingsRepository';
import type { CreateAiSettingsDto, LlmProvider, UpdateAiSettingsDto } from './AiSettingsDto';
import { PROVIDERS, buildModel } from '../agent/LlmProviderFactory';

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

@Service()
export class AiSettingsService {
  constructor(
    private repo: AiSettingsRepository,
    private encryption: EncryptionService,
  ) {
    this.repo.setEncryption(encryption);
  }

  async getPublic() {
    const row = await this.repo.get();
    return this.repo.toPublic(row);
  }

  async getInternal() {
    const row = await this.repo.get();
    return row ? this.repo.decryptApiKey(row) : null;
  }

  async upsert(dto: CreateAiSettingsDto) {
    const existing = await this.repo.get();
    const provider = dto.provider ?? 'ollama';
    const providerKeys = this.repo.readProviderKeys(existing);
    const providerModels = this.repo.readProviderModels(existing);
    const providerModelOptions = this.repo.readProviderModelOptions(existing);
    if (dto.apiKey) providerKeys[provider] = dto.apiKey;
    providerModels[provider] = dto.model ?? providerModels[provider] ?? 'llama3.1';
    providerModelOptions[provider] = this.mergeModelOptions(
      providerModelOptions[provider],
      dto.modelOptions,
      providerModels[provider],
    );

    const data: Record<string, any> = {
      provider,
      baseUrl: dto.baseUrl ?? null,
      model: this.repo.serializeProviderModels(providerModels, provider, providerModelOptions),
      systemPrompt: dto.systemPrompt ?? null,
      isEnabled: dto.isEnabled ?? true,
      useMemory: dto.useMemory ?? true,
      maxStoredMessages: dto.maxStoredMessages ?? 100,
      maxPromptMessages: dto.maxPromptMessages ?? 10,
      apiKeyEncrypted: this.repo.encryptProviderKeys(providerKeys),
    };
    if (dto.id) data.id = dto.id;

    if (existing) {
      return this.repo.toPublic(await this.repo.update(existing.id, data));
    }
    return this.repo.toPublic(await this.repo.create(data));
  }

  async update(dto: UpdateAiSettingsDto) {
    const existing = await this.repo.get();
    const data: Record<string, any> = {};
    const provider = (dto.provider ?? existing?.provider ?? 'ollama') as LlmProvider;

    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl;
    if (dto.model !== undefined) {
      const providerModels = this.repo.readProviderModels(existing);
      const providerModelOptions = this.repo.readProviderModelOptions(existing);
      providerModels[provider] = dto.model;
      providerModelOptions[provider] = this.mergeModelOptions(
        providerModelOptions[provider],
        dto.modelOptions,
        dto.model,
      );
      data.model = this.repo.serializeProviderModels(providerModels, provider, providerModelOptions);
    } else if (dto.modelOptions !== undefined) {
      const providerModels = this.repo.readProviderModels(existing);
      const providerModelOptions = this.repo.readProviderModelOptions(existing);
      providerModelOptions[provider] = this.mergeModelOptions(
        providerModelOptions[provider],
        dto.modelOptions,
        providerModels[provider],
      );
      data.model = this.repo.serializeProviderModels(providerModels, provider, providerModelOptions);
    }
    if (dto.systemPrompt !== undefined) data.systemPrompt = dto.systemPrompt;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.useMemory !== undefined) data.useMemory = dto.useMemory;
    if (dto.maxStoredMessages !== undefined) data.maxStoredMessages = dto.maxStoredMessages;
    if (dto.maxPromptMessages !== undefined) data.maxPromptMessages = dto.maxPromptMessages;

    if (dto.apiKey !== undefined) {
      const providerKeys = this.repo.readProviderKeys(existing);
      const normalizedKey = normalizeText(dto.apiKey);
      if (normalizedKey) {
        providerKeys[provider] = normalizedKey;
      } else {
        delete providerKeys[provider];
      }
      data.apiKeyEncrypted = this.repo.encryptProviderKeys(providerKeys);
    }

    if (!existing) {
      return this.repo.toPublic(await this.repo.create({
        provider: data.provider ?? 'ollama',
        ...data,
        model: data.model ?? this.repo.serializeProviderModels({ [provider]: 'llama3.1' }, provider),
        isEnabled: data.isEnabled ?? true,
        useMemory: data.useMemory ?? true,
        maxStoredMessages: data.maxStoredMessages ?? 100,
        maxPromptMessages: data.maxPromptMessages ?? 10,
      }));
    }

    return this.repo.toPublic(await this.repo.update(existing.id, data));
  }

  async testConnection(dto: UpdateAiSettingsDto) {
    const row = await this.repo.get();
    const existing = row ? this.repo.decryptApiKey(row) : null;
    const provider = dto.provider ?? existing?.provider ?? 'ollama';
    const meta = PROVIDERS[provider];

    const resolvedModel =
      normalizeText(dto.model)
      ?? normalizeText(existing?.providerModels?.[provider])
      ?? existing?.model
      ?? meta.defaultModel;
    const resolvedBaseUrl =
      dto.baseUrl !== undefined
        ? normalizeText(dto.baseUrl)
        : normalizeText(existing?.baseUrl) ?? normalizeText(meta.defaultBaseUrl);
    const resolvedApiKey =
      dto.apiKey !== undefined
        ? normalizeText(dto.apiKey) ?? normalizeText(existing?.providerKeys?.[provider])
        : normalizeText(existing?.providerKeys?.[provider]);

    if (meta.needsKey && !resolvedApiKey) {
      throw new Error('API key is required for this provider.');
    }

    if (meta.needsUrl && !resolvedBaseUrl) {
      throw new Error('Base URL is required for this provider.');
    }

    buildModel({
      provider,
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl,
      model: resolvedModel,
    });

    return {
      ok: true,
      provider,
      resolvedModel,
      needsKey: meta.needsKey,
      needsUrl: meta.needsUrl,
    };
  }

  private mergeModelOptions(
    existing: string[] | undefined,
    requested: string[] | undefined,
    selected: string | null | undefined,
  ): string[] {
    const base = requested ?? existing ?? [];
    const models = [...base];
    const normalizedSelected = normalizeText(selected);
    if (requested === undefined && normalizedSelected && !models.includes(normalizedSelected)) {
      models.unshift(normalizedSelected);
    }
    return [...new Set(models.map((model) => model.trim()).filter(Boolean))];
  }
}
