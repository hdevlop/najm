import { Service, Inject } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig, RagToolRoutingConfig, ToolRoutingFallback } from '../config';
import { RoutingSettingsRepository } from './RoutingSettingsRepository';
import type { UpdateRoutingSettingsDto, EffectiveRoutingSettings } from './RoutingSettingsDto';

@Service()
export class RoutingSettingsService {
  private cache: EffectiveRoutingSettings | null = null;
  private cacheKey: unknown = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 5000;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private repo: RoutingSettingsRepository,
  ) {}

  async getEffectiveSettings(baseConfig?: Partial<RagToolRoutingConfig>): Promise<EffectiveRoutingSettings> {
    const now = Date.now();
    // Cache key: identity of the base config (reference) when provided,
    // otherwise a fixed symbol. Identity check keeps repeated calls with the
    // same hot-reloaded file config (stable reference until mtime changes)
    // off the DB read path.
    const cacheKey = baseConfig ?? CACHE_KEY_NO_BASE;
    if (this.cache && cacheKey === this.cacheKey && now < this.cacheExpiry) {
      return this.cache;
    }

    const dbRow = await this.repo.get();
    const boot = baseConfig ?? this.config.toolRouting;

    const settings: EffectiveRoutingSettings = {
      enableKnowledge: dbRow?.enableKnowledge ?? true,
      maxTools: dbRow?.maxTools ?? boot.maxTools,
      topSemanticHits: dbRow?.topSemanticHits ?? boot.topSemanticHits,
      similarityThreshold: dbRow?.similarityThreshold != null
        ? parseFloat(dbRow.similarityThreshold)
        : boot.similarityThreshold,
      fallbackOnRouterError: dbRow?.fallbackOnRouterError ?? boot.fallbackOnRouterError,
      fallbackOnNoMatch: dbRow?.fallbackOnNoMatch ?? boot.fallbackOnNoMatch,
      allowedLangs: Array.isArray(dbRow?.allowedLangs)
        ? (dbRow.allowedLangs.length > 0 ? dbRow.allowedLangs : undefined)
        : this.config.allowedLangs,
      dependencies: dbRow?.dependencies ?? boot.dependencies,
      toolsOverride: dbRow?.toolsOverride ?? 'auto',
      contextOverride: dbRow?.contextOverride ?? 'auto',
      source: dbRow ? 'db' : 'boot',
    };

    this.cache = settings;
    this.cacheKey = cacheKey;
    this.cacheExpiry = now + this.CACHE_TTL_MS;
    return settings;
  }

  async getRoutingConfig(baseConfig?: Partial<RagToolRoutingConfig>): Promise<RagToolRoutingConfig> {
    const s = await this.getEffectiveSettings(baseConfig);
    return {
      enabled: this.config.toolRouting.enabled,
      maxTools: s.maxTools,
      topSemanticHits: s.topSemanticHits,
      similarityThreshold: s.similarityThreshold,
      fallbackOnRouterError: s.fallbackOnRouterError,
      fallbackOnNoMatch: s.fallbackOnNoMatch,
      dependencies: s.dependencies,
    };
  }

  async updateSettings(dto: UpdateRoutingSettingsDto): Promise<EffectiveRoutingSettings> {
    const existing = await this.repo.get();

    const data: Record<string, any> = {};
    if (dto.enableKnowledge !== undefined) data.enableKnowledge = dto.enableKnowledge;
    if (dto.maxTools !== undefined) data.maxTools = dto.maxTools;
    if (dto.topSemanticHits !== undefined) data.topSemanticHits = dto.topSemanticHits;
    if (dto.similarityThreshold !== undefined) data.similarityThreshold = String(dto.similarityThreshold);
    if (dto.fallbackOnRouterError !== undefined) data.fallbackOnRouterError = dto.fallbackOnRouterError;
    if (dto.fallbackOnNoMatch !== undefined) data.fallbackOnNoMatch = dto.fallbackOnNoMatch;
    if (dto.allowedLangs !== undefined) data.allowedLangs = [...new Set(dto.allowedLangs.map((lang) => lang.trim()).filter(Boolean))];
    if (dto.dependencies !== undefined) data.dependencies = dto.dependencies;
    if (dto.toolsOverride !== undefined) data.toolsOverride = dto.toolsOverride;
    if (dto.contextOverride !== undefined) data.contextOverride = dto.contextOverride;

    if (existing) {
      await this.repo.update(existing.id, data);
    } else {
      await this.repo.create(data);
    }

    this.invalidateCache();
    return this.getEffectiveSettings();
  }

  invalidateCache() {
    this.cache = null;
    this.cacheKey = null;
    this.cacheExpiry = 0;
  }
}

const CACHE_KEY_NO_BASE = Symbol.for('najm:rag:routing-settings:no-base');
