import { Service, Inject, HttpError, LoggerService, LOGGER, DI, type Container } from 'najm-core';
import { McpRegistryService, type McpToolConfirmation } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig, SemanticSeed } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository, ToolIndexerService } from '../toolIndex';
import { ChatbotRagValidator } from './ChatbotRagValidator';
import { getRoutableTools } from '../toolVisibility';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { RoutingPreviewService } from '../toolRouter/RoutingPreviewService';
import { canonicalizeRoutingText } from '../toolRouter/ToolRouterUtils';
import type {
  SemanticPhraseResponse,
  PaginatedSemanticsResponse,
  SemanticGroupsResponse,
  SemanticReindexResult,
  SemanticSeedResult,
} from './ChatbotRagDto';
import type { CreateSemanticDto, UpdateSemanticDto } from './ChatbotRagDto';
import type { RoutingPreviewResult } from '../toolRouter/ToolRouterDto';

@Service()
export class SemanticPhraseService {
  @Inject(LOGGER) private log!: LoggerService;
  @DI() private container!: Container;

  constructor(
    @Inject() private repository: ToolIndexRepository,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private validator: ChatbotRagValidator,
    @Inject() private indexer: ToolIndexerService,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private settings?: RoutingSettingsService,
    @Inject() private preview?: RoutingPreviewService,
  ) {}

  /** Phrases are stored as typed and embedded the way routing embeds a message. */
  private phraseText(phrase: string): string {
    return canonicalizeRoutingText(phrase, this.config.rewriteRoutingQuery);
  }

  async getStatus() {
    const routing = this.config.toolRouting;
    const indexedCount = await this.repository.countEmbeddings();
    const semanticCount = await this.repository.countSemantics();
    const embedding = this.config.rag?.embedding ?? (this.config.toolRouting as any)?.embedding;
    const embeddingModel = embedding?.model ?? 'embeddinggemma';
    const effective = this.settings
      ? await this.settings.getEffectiveSettings()
      : null;
    return {
      routingEnabled: routing?.enabled ?? false,
      dialect: this.config.dialect ?? 'pg',
      embeddingProvider: embedding?.provider ?? 'ollama',
      embeddingModel,
      embeddingDimensions: embedding?.dimensions ?? 768,
      registeredToolCount: getRoutableTools(this.registry.tools).length,
      indexedToolCount: indexedCount,
      semanticPhraseCount: semanticCount,
      // Phrases to re-embed after a model or routing-text change.
      staleSemanticCount: await Promise.resolve().then(() => this.repository.countStaleSemantics()).catch(() => null),
      indexingRunning: this.indexer.isIndexing,
      effectiveSettings: effective,
    };
  }

  async indexTools() {
    const alreadyRunning = this.indexer.isIndexing;
    const result = await this.indexer.indexTools();
    return { status: alreadyRunning ? 'already_running' : 'completed', ...result };
  }

  async previewRouting(query: string): Promise<RoutingPreviewResult> {
    if (!this.preview) {
      return {
        query,
        normalized: query,
        status: 'disabled',
        matches: [],
        dependencies: [],
        routingDecisions: [],
        confirmations: [],
        finalTools: [],
        config: {
          maxTools: 0,
          topSemanticHits: 0,
          similarityThreshold: 0,
          fallbackOnNoMatch: 'none',
          fallbackOnRouterError: 'all',
        },
      };
    }
    return this.preview.previewRouting(query);
  }

  async createSemantic(dto: CreateSemanticDto): Promise<SemanticPhraseResponse> {
    const lang = (dto.lang ?? 'und').trim() || 'und';
    let embedding: number[] | null = null;
    let embeddingError: string | null = null;
    try {
      embedding = await this.embedding.embed(this.phraseText(dto.phrase), 'document', 'semantic-index');
    } catch (err) {
      embeddingError = err instanceof Error ? err.message : String(err);
      this.log?.warn?.(`[semantic-phrase] createSemantic: embedding failed for phrase "${dto.phrase}" → saved as PENDING. Reason: ${embeddingError}`);
    }
    await this.repository.upsertSemantic({
      toolName: dto.toolName,
      phrase: dto.phrase,
      lang,
      source: 'admin',
      embedding: embedding ?? undefined,
    });
    const row = await this.repository.listSemantics(dto.toolName);
    const created = row.find((r) => r.phrase === dto.phrase && r.lang === lang);
    if (!created) HttpError.internal('Failed to retrieve created semantic phrase');
    const response = this.toSemanticResponse(created);
    if (embeddingError) (response as SemanticPhraseResponse & { embeddingError?: string }).embeddingError = embeddingError;
    return response;
  }

  async updateSemantic(id: string, dto: UpdateSemanticDto): Promise<SemanticPhraseResponse> {
    const existing = await this.repository.findSemanticById(id);
    if (!existing) HttpError.notFound(`Semantic phrase not found: ${id}`);

    const phraseChanged = dto.phrase !== undefined && dto.phrase !== existing.phrase;
    let newEmbedding: number[] | undefined;

    if (phraseChanged) {
      try {
        newEmbedding = await this.embedding.embed(this.phraseText(dto.phrase!), 'document', 'semantic-index');
      } catch {
        // keep existing embedding if re-embed fails
      }
    }

    const patch: Parameters<typeof this.repository.updateSemanticById>[1] = {};
    if (dto.phrase !== undefined) patch.phrase = dto.phrase;
    if (dto.lang !== undefined) patch.lang = dto.lang;
    if (phraseChanged) patch.embedding = newEmbedding ?? null;

    await this.repository.updateSemanticById(id, patch);
    const updated = await this.repository.findSemanticById(id);
    return this.toSemanticResponse(updated!);
  }

  async deleteSemantic(id: string): Promise<{ deleted: boolean }> {
    const existing = await this.repository.findSemanticById(id);
    if (!existing) HttpError.notFound(`Semantic phrase not found: ${id}`);
    await this.repository.deleteSemanticById(id);
    return { deleted: true };
  }

  async deleteSemanticsBatch(ids: string[]): Promise<{ deleted: number }> {
    const cleanIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const deleted = await this.repository.deleteSemanticsByIds(cleanIds);
    return { deleted };
  }

  async deleteAllSemantics(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAllSemantics();
    return { deleted };
  }

  async listSemantics(toolName?: string): Promise<SemanticPhraseResponse[]> {
    const rows = await this.repository.listSemantics(toolName);
    return rows.map((r) => this.toSemanticResponse(r));
  }

  async listSemanticsPaginated(opts: {
    toolName?: string;
    toolGroup?: string;
    lang?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedSemanticsResponse> {
    const rawLimit = opts.limit ?? 100;
    const rawOffset = opts.offset ?? 0;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
    const { items, total } = await this.repository.listSemanticsPaginated({
      toolName: opts.toolName,
      toolNames: this.resolveToolNamesForGroup(opts.toolGroup),
      lang: opts.lang,
      search: opts.search,
      limit,
      offset,
    });
    return {
      items: items.map((r) => this.toSemanticResponse(r)),
      total,
      limit,
      offset,
    };
  }

  async getSemanticGroups(toolName?: string, toolGroup?: string): Promise<SemanticGroupsResponse> {
    return this.repository.getSemanticGroups(toolName, this.resolveToolNamesForGroup(toolGroup));
  }

  async getSemanticById(id: string): Promise<SemanticPhraseResponse> {
    const row = await this.repository.findSemanticById(id);
    if (!row) HttpError.notFound(`Semantic phrase not found: ${id}`);
    return this.toSemanticResponse(row);
  }

  async exportSemantics(): Promise<Record<string, Record<string, string[]>>> {
    const rows = await this.repository.listSemantics();
    const grouped = new Map<string, Map<string, string[]>>();
    const seen = new Set<string>();
    for (const row of rows) {
      const toolName = String(row.toolName ?? '').trim();
      const phrase = String(row.phrase ?? '').trim();
      const lang = String(row.lang ?? 'und').trim() || 'und';
      const key = `${toolName}\u0000${phrase}\u0000${lang}`;
      if (!toolName || !phrase || seen.has(key)) continue;
      seen.add(key);
      if (!grouped.has(toolName)) grouped.set(toolName, new Map());
      const langMap = grouped.get(toolName)!;
      if (!langMap.has(lang)) langMap.set(lang, []);
      langMap.get(lang)!.push(phrase);
    }

    const output: Record<string, Record<string, string[]>> = {};
    for (const [toolName, langMap] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      output[toolName] = {};
      for (const [lang, phrases] of [...langMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        output[toolName][lang] = phrases.sort((a, b) => a.localeCompare(b));
      }
    }

    return output;
  }

  /**
   * Embeds phrases that have no vector or whose vector came from a different
   * embedder setup (see `routingTextVersion`); `force` re-embeds every phrase.
   */
  async reindexSemantics(options: { force?: boolean } = {}): Promise<SemanticReindexResult> {
    const rows = await this.repository.listSemanticsToReindex(options.force === true);
    let reindexed = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const [embedding] = await this.embedding.embedBatch([this.phraseText(row.phrase)], 'document', 'semantic-index');
        await this.repository.updateSemanticEmbeddingById(row.id, embedding);
        reindexed++;
      } catch {
        failed++;
      }
    }

    return { reindexed, skipped: 0, failed };
  }

  /**
   * Adds the seed's phrases that are not stored yet (same tool, phrase and
   * language), for registered tools only. Stored phrases are not touched or
   * re-embedded. See `RagConfig.seedSemantics`.
   */
  async seedSemantics(seed: SemanticSeed): Promise<SemanticSeedResult> {
    const key = (toolName: string, phrase: string, lang?: string | null) =>
      `${toolName.trim()}\u0000${phrase.trim()}\u0000${(lang ?? 'und').trim() || 'und'}`;
    const stored = new Set((await this.repository.listSemantics()).map((row) => key(row.toolName, row.phrase, row.lang)));
    const known = new Set(getRoutableTools(this.registry.tools).map((tool) => tool.name));
    const unknownTools: string[] = [];
    let alreadyStored = 0;
    const items: SemanticSeed['items'] = [];
    for (const item of seed.items ?? []) {
      const toolName = item.toolName?.trim();
      if (!toolName) continue;
      if (!known.has(toolName)) { unknownTools.push(toolName); continue; }
      const phrases = (item.phrases ?? []).filter((p) => {
        if (!p?.phrase?.trim()) return false;
        if (stored.has(key(toolName, p.phrase, p.lang))) { alreadyStored++; return false; }
        return true;
      });
      if (phrases.length) items.push({ toolName, phrases });
    }
    if (!items.length) return { inserted: 0, alreadyStored, failed: 0, unknownTools };
    const { results } = await this.importSemantics({ items }, { source: 'seed' });
    return {
      inserted: results.filter((r) => r.status === 'inserted' || r.status === 'updated').length,
      alreadyStored,
      failed: results.filter((r) => r.status === 'skipped' && r.error).length,
      unknownTools,
    };
  }

  async importSemantics(
    body: Parameters<typeof this.validator.normalizeSemanticImport>[0],
    options: { source?: string } = {},
  ): Promise<{ results: import('./ChatbotRagDto').ImportSemanticResult[] }> {
    const state = this.validator.normalizeSemanticImport(body);

    if (!this.validator.hasSemanticEntries(state)) {
      return this.validator.completeSemanticImport(state);
    }

    const embeddings = await this.validator.resolveSemanticEmbeddings(
      this.embedding.embedBatch(this.validator.getSemanticImportPhrases(state).map((p) => this.phraseText(p)), 'document', 'semantic-index'),
      state,
    );

    if (!embeddings) {
      return this.validator.completeSemanticImport(state);
    }

    for (let i = 0; i < state.entries.length; i++) {
      const entry = state.entries[i];
      await this.validator.resolveSemanticUpsert(
        this.repository.upsertSemantic({
          toolName: entry.toolName,
          phrase: entry.phrase,
          lang: entry.lang,
          source: options.source ?? 'import',
          sourceFile: entry.sourceFile ?? null,
          embedding: embeddings[i],
        }),
        state,
        entry,
      );
    }

    const result = this.validator.completeSemanticImport(state);
    await this.repository.pruneDuplicateSemantics?.();
    return result;
  }

  private toSemanticResponse(row: any): SemanticPhraseResponse {
    const response: SemanticPhraseResponse = {
      id: row.id,
      toolName: row.toolName,
      phrase: row.phrase,
      lang: row.lang,
      source: row.source ?? null,
      sourceFile: row.sourceFile ?? null,
      hasEmbedding: row.embedding != null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
    const confirmation = this.registry.tools.find((tool) => tool.name === row.toolName)?.confirmation;
    if (confirmation) {
      response.confirmation = this.resolveConfirmation(confirmation);
    }
    return response;
  }

  private resolveConfirmation(confirmation?: McpToolConfirmation): { level?: 'notice' | 'warning' | 'danger'; message?: string; resolvedMessage?: string } | undefined {
    if (!confirmation) return undefined;
    const result: { level?: 'notice' | 'warning' | 'danger'; message?: string; resolvedMessage?: string } = {
      level: confirmation.level,
      message: confirmation.message,
    };
    if (confirmation.message) {
      result.resolvedMessage = this.resolveI18nMessage(confirmation.message);
    }
    return result;
  }

  private resolveI18nMessage(message: string): string {
    try {
      const i18n = this.container?.get(Symbol.for('I18nService')) as { t?: (key: string) => string } | undefined;
      return i18n?.t?.(message) || message;
    } catch {
      return message;
    }
  }

  private resolveToolNamesForGroup(group?: string): string[] | undefined {
    const trimmed = group?.trim();
    if (!trimmed) return undefined;
    return getRoutableTools(this.registry.tools)
      .filter((tool) => (tool.group ?? 'default') === trimmed)
      .map((tool) => tool.name);
  }
}
