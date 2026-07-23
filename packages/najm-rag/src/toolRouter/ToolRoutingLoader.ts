import { readFileSync, statSync } from 'fs';
import { Service, Inject, LoggerService } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig, RagToolRoutingConfig } from '../config';
import type { CachedRouting } from './ToolRouterDto';
import { ToolRouterValidator } from './ToolRouterValidator';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';

@Service()
export class ToolRoutingLoader {
  private cache: CachedRouting | null = null;
  private loading: Promise<RagToolRoutingConfig> | null = null;
  private baselineRag: unknown | null = null;
  private readonly filePath: string | undefined;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject(LoggerService) private log: LoggerService,
    @Inject() private validator: ToolRouterValidator,
    @Inject() private settingsService: RoutingSettingsService,
  ) {
    this.filePath = this.config.configPath;
    if (this.filePath) {
      this.validator.assertFilePath(this.filePath);
    }
  }

  async getRoutingConfig(): Promise<RagToolRoutingConfig> {
    if (!this.filePath) {
      // No file path: read from DB + boot config via settings service
      return this.settingsService.getRoutingConfig();
    }

    // Load file config (with mtime cache) and merge DB settings over it
    const fileConfig = await this.getFileConfig();
    return this.settingsService.getRoutingConfig(fileConfig);
  }

  private async getFileConfig(): Promise<RagToolRoutingConfig> {
    if (this.cache) {
      const isValid = this.getFileMtime(this.filePath!) === this.cache.mtime;
      if (isValid) return this.cache.config;
    }

    if (!this.loading) {
      this.loading = this.load(this.filePath!).finally(() => {
        this.loading = null;
      });
    }

    try {
      return await this.loading;
    } catch (error) {
      if (this.cache) {
        const msg = `[chatbot-rag] Routing config reload failed, using stale cache: ${error instanceof Error ? error.message : String(error)}`;
        this.log?.error?.(msg) ?? console.error(msg);
        return this.cache.config;
      }
      throw error;
    }
  }

  private async load(filePath: string): Promise<RagToolRoutingConfig> {
    this.validator.assertFileExists(filePath);

    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const data = this.validator.assertValidConfig(parsed);

    // Track rag-related fields for hot-reload safety
    const ragSnapshot = {
      embedding: data.embedding,
      indexOnBoot: data.indexOnBoot,
    };

    if (this.baselineRag === null) {
      this.baselineRag = ragSnapshot;
    } else {
      this.validator.assertRagUnchanged(ragSnapshot, this.baselineRag);
    }

    const config: RagToolRoutingConfig = {
      enabled: this.config.toolRouting?.enabled ?? true,
      maxTools: data.maxTools,
      topSemanticHits: data.topSemanticHits,
      similarityThreshold: data.similarityThreshold,
      fallbackOnRouterError: data.fallbackOnRouterError,
      fallbackOnNoMatch: data.fallbackOnNoMatch,
      dependencies: data.dependencies,
    };

    const mtime = this.getFileMtime(filePath);
    this.cache = { config, mtime, loadedAt: Date.now() };
    return config;
  }

  private getFileMtime(filePath: string): number {
    try {
      return statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }
}
