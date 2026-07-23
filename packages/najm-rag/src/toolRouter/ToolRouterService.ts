import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { McpRegistryService } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from '../toolIndex';
import type { ToolRouterResult } from './ToolRouterDto';
import { normalizeQuery } from './ToolRouterUtils';
import { ToolRoutingLoader } from './ToolRoutingLoader';
import { UnmatchedQueryService } from '../unmatched';
import { getRoutableTools } from '../toolVisibility';
import { selectPrimaryTool, filterAlternativeMutations } from './RoutingLogic';

@Service()
@Meta({ layer: 'plugin', order: 56 })
export class ToolRouterService {
  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private repository: ToolIndexRepository,
    @Inject(LoggerService) private log: LoggerService,
    @Inject() private provider: ToolRoutingLoader,
    @Inject() private unmatched?: UnmatchedQueryService,
  ) {}

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
      const embedding = await this.embedding.embed(normalized);

      const maxTools = routing.maxTools ?? 12;
      const topSemanticHits = routing.topSemanticHits ?? 8;
      const threshold = routing.similarityThreshold ?? 0.45;

      const registeredToolNames = new Set(routableTools.map((tool) => tool.name));
      // Phase 5.P6: probe at threshold 0 once per table, reuse the top-1
      // similarity for the miss record instead of re-running two more
      // searches with the threshold filter. Fall back to tool embeddings
      // when the filtered semantic matches are empty, not when raw
      // (threshold-zero) semantic matches are empty, so a low-confidence
      // semantic hit no longer masks a valid embedding match.
      const probeLimit = Math.max(topSemanticHits, 1);
      const rawSemanticMatches = this.filterRegisteredMatches(
        await this.repository.searchSemantics(embedding, probeLimit, 0),
        registeredToolNames,
      );
      let semanticMatches = rawSemanticMatches.filter((m) => m.similarity >= threshold);

      let rawEmbeddingMatches: typeof rawSemanticMatches = [];
      if (semanticMatches.length === 0) {
        rawEmbeddingMatches = this.filterRegisteredMatches(
          await this.repository.searchEmbeddings(embedding, probeLimit, 0),
          registeredToolNames,
        );
      }

      const matches = semanticMatches.length > 0
        ? semanticMatches
        : rawEmbeddingMatches.filter((m) => m.similarity >= threshold);

      if (matches.length === 0) {
        const probeSource = rawSemanticMatches.length > 0 ? rawSemanticMatches : rawEmbeddingMatches;
        await this.recordUnmatchedQuery(
          userText,
          normalized,
          probeSource[0]?.similarity ?? 0,
          threshold,
          probeSource.length > 0 ? 'low_confidence' : 'no_match',
        );
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
    score: number,
    threshold: number,
    source: 'low_confidence' | 'no_match',
  ): Promise<void> {
    try {
      await this.unmatched?.recordMiss({
        query: userText,
        normalized,
        score,
        threshold,
        source,
      });
    } catch (err) {
      this.log.warn?.('[chatbot-rag] Failed to record unmatched query:', err);
    }
  }
}
