import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { McpRegistryService } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from '../toolIndex';
import type { ToolRouterResult } from './ToolRouterDto';
import { normalizeQuery, EmbeddingLru } from './ToolRouterUtils';
import { ToolRoutingLoader } from './ToolRoutingLoader';
import { UnmatchedQueryService } from '../unmatched';
import { getRoutableTools } from '../toolVisibility';
import { selectPrimaryTool, filterAlternativeMutations } from './RoutingLogic';

@Service()
@Meta({ layer: 'plugin', order: 56 })
export class ToolRouterService {
  private queryCache: EmbeddingLru;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private repository: ToolIndexRepository,
    @Inject(LoggerService) private log: LoggerService,
    @Inject() private provider: ToolRoutingLoader,
    @Inject() private unmatched?: UnmatchedQueryService,
  ) {
    const cacheSize =
      this.config.rag?.queryEmbeddingCacheSize ??
      (this.config as any).toolRouting?.queryEmbeddingCacheSize ??
      256;
    this.queryCache = new EmbeddingLru(Math.max(0, cacheSize));
  }

  async findRelevantTools(userText: string): Promise<ToolRouterResult> {
    const routing = await this.provider.getRoutingConfig();
    const routableTools = getRoutableTools(this.registry.tools);
    if (!routing || routing.enabled !== true) {
      return { status: 'disabled', tools: routableTools };
    }

    const normalized = normalizeQuery(userText);
    if (!normalized) {
      return this.applyFallbackResult(routing.fallbackOnNoMatch ?? 'none');
    }

    try {
      let embedding = this.queryCache.get(normalized);
      if (!embedding) {
        embedding = await this.embedding.embed(normalized);
        this.queryCache.set(normalized, embedding);
      }

      const maxTools = routing.maxTools ?? 12;
      const topSemanticHits = routing.topSemanticHits ?? 8;
      const threshold = routing.similarityThreshold ?? 0.45;

      const registeredToolNames = new Set(routableTools.map((tool) => tool.name));
      let matches = this.filterRegisteredMatches(
        await this.repository.searchSemantics(embedding, topSemanticHits, threshold),
        registeredToolNames,
      );
      if (matches.length === 0) {
        matches = this.filterRegisteredMatches(
          await this.repository.searchEmbeddings(embedding, topSemanticHits, threshold),
          registeredToolNames,
        );
      }

      if (matches.length === 0) {
        await this.recordUnmatchedQuery(userText, normalized, embedding, threshold, topSemanticHits);
        return this.applyFallbackResult(routing.fallbackOnNoMatch ?? 'none');
      }

      const toolNameSet = new Set(matches.map((m) => m.toolName));
      const orderedToolNames: string[] = [...toolNameSet];

      const deps = routing.dependencies ?? {};
      for (const name of orderedToolNames) {
        const depNames = deps[name];
        if (depNames) {
          for (const dep of depNames) {
            if (!toolNameSet.has(dep)) {
              toolNameSet.add(dep);
              orderedToolNames.push(dep);
            }
          }
        }
      }

      const registryMap = new Map(routableTools.map((t) => [t.name, t]));
      const primaryName = selectPrimaryTool(matches);
      const explicitDeps = new Set<string>(
        primaryName ? deps[primaryName] ?? [] : [],
      );

      const orderedWithPrimaryFirst = primaryName
        ? [primaryName, ...orderedToolNames.filter((n) => n !== primaryName)]
        : orderedToolNames;

      const kept = filterAlternativeMutations(
        orderedWithPrimaryFirst,
        primaryName,
        explicitDeps,
        registryMap,
      );

      const result: typeof routableTools = [];
      for (const name of kept.slice(0, maxTools)) {
        const tool = registryMap.get(name);
        if (tool) result.push(tool);
      }

      return { status: 'routed', tools: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error?.('[chatbot-rag] Tool routing failed:', error);
      const fallback = routing.fallbackOnRouterError ?? 'all';
      return { status: 'router_error', tools: fallback === 'all' ? routableTools : [], error: message };
    }
  }

  private filterRegisteredMatches<T extends { toolName: string }>(
    matches: T[],
    registeredToolNames: Set<string>,
  ): T[] {
    return matches.filter((match) => registeredToolNames.has(match.toolName));
  }

  private applyFallbackResult(fallback: 'all' | 'none'): ToolRouterResult {
    if (fallback === 'all') return { status: 'fallback_all', tools: getRoutableTools(this.registry.tools) };
    return { status: 'fallback_none', tools: [] };
  }

  private async recordUnmatchedQuery(
    userText: string,
    normalized: string,
    embedding: number[],
    threshold: number,
    topSemanticHits: number,
  ): Promise<void> {
    try {
      let probe = await this.repository.searchSemantics(embedding, 1, 0);
      if (probe.length === 0) {
        probe = await this.repository.searchEmbeddings(embedding, Math.max(1, Math.min(topSemanticHits, 1)), 0);
      }
      await this.unmatched?.recordMiss({
        query: userText,
        normalized,
        score: probe[0]?.similarity ?? 0,
        threshold,
        source: probe.length > 0 ? 'low_confidence' : 'no_match',
      });
    } catch (err) {
      this.log.warn?.('[chatbot-rag] Failed to record unmatched query:', err);
    }
  }
}
