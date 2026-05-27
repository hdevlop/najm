import { Service, Inject, LoggerService, DI, type Container } from 'najm-core';
import { McpRegistryService, type RegisteredTool } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from '../toolIndex';
import type {
  RoutingPreviewResult,
  RoutingPreviewMatch,
  RoutingPreviewDependency,
  RoutingPreviewRoutingDecision,
  RoutingPreviewConfirmation,
  RoutingPreviewToolScore,
} from './ToolRouterDto';
import { normalizeQuery, EmbeddingLru } from './ToolRouterUtils';
import { ToolRoutingLoader } from './ToolRoutingLoader';
import { getRoutableTools } from '../toolVisibility';
import { selectPrimaryTool, filterAlternativeMutations } from './RoutingLogic';

@Service()
export class RoutingPreviewService {
  private queryCache: EmbeddingLru;
  @DI() private container!: Container;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private repository: ToolIndexRepository,
    @Inject(LoggerService) private log: LoggerService,
    @Inject() private provider: ToolRoutingLoader,
  ) {
    const cacheSize =
      this.config.rag?.queryEmbeddingCacheSize ??
      (this.config as any).toolRouting?.queryEmbeddingCacheSize ??
      256;
    this.queryCache = new EmbeddingLru(Math.max(0, cacheSize));
  }

  async previewRouting(userText: string): Promise<RoutingPreviewResult> {
    const routing = await this.provider.getRoutingConfig();
    const routableTools = getRoutableTools(this.registry.tools);

    const maxTools = routing?.maxTools ?? 12;
    const topSemanticHits = routing?.topSemanticHits ?? 8;
    const similarityThreshold = routing?.similarityThreshold ?? 0.45;
    const fallbackOnNoMatch = routing?.fallbackOnNoMatch ?? 'none';
    const fallbackOnRouterError = routing?.fallbackOnRouterError ?? 'all';

    const config = { maxTools, topSemanticHits, similarityThreshold, fallbackOnNoMatch, fallbackOnRouterError };
    const normalized = normalizeQuery(userText);

    if (!routing || routing.enabled !== true) {
      return {
        query: userText, normalized, status: 'disabled',
        matches: [], dependencies: [], routingDecisions: [], confirmations: this.getConfirmations(routableTools.map((t) => t.name)),
        finalTools: routableTools.map((t) => t.name), config,
      };
    }

    if (!normalized) {
      const fallback = routing.fallbackOnNoMatch ?? 'none';
      return {
        query: userText, normalized,
        status: fallback === 'all' ? 'fallback_all' : 'fallback_none',
        matches: [], dependencies: [], routingDecisions: [], confirmations: this.getConfirmations(fallback === 'all' ? routableTools.map((t) => t.name) : []),
        finalTools: fallback === 'all' ? routableTools.map((t) => t.name) : [],
        config,
      };
    }

    try {
      let embedding = this.queryCache.get(normalized);
      if (!embedding) {
        embedding = await this.embedding.embed(normalized);
        this.queryCache.set(normalized, embedding);
      }

      const registeredToolNames = new Set(routableTools.map((tool) => tool.name));
      let rawMatches = this.filterRegisteredMatches(
        await this.repository.searchSemantics(embedding, topSemanticHits, similarityThreshold),
        registeredToolNames,
      );
      let matchSource: 'semantics' | 'embeddings' = 'semantics';
      if (rawMatches.length === 0) {
        rawMatches = this.filterRegisteredMatches(
          await this.repository.searchEmbeddings(embedding, topSemanticHits, similarityThreshold),
          registeredToolNames,
        );
        matchSource = 'embeddings';
      }

      if (rawMatches.length === 0) {
        const fallback = routing.fallbackOnNoMatch ?? 'none';
        return {
          query: userText, normalized,
          status: fallback === 'all' ? 'fallback_all' : 'fallback_none',
          matches: [], dependencies: [], routingDecisions: [], confirmations: this.getConfirmations(fallback === 'all' ? routableTools.map((t) => t.name) : []),
          finalTools: fallback === 'all' ? routableTools.map((t) => t.name) : [],
          config,
        };
      }

      const matches: RoutingPreviewMatch[] = rawMatches.map((m) => ({
        toolName: m.toolName,
        similarity: m.similarity,
        source: matchSource,
      }));

      const toolNameSet = new Set(rawMatches.map((m) => m.toolName));
      const orderedToolNames = [...toolNameSet];
      const dependencies: RoutingPreviewDependency[] = [];

      const deps = routing.dependencies ?? {};
      for (const name of [...orderedToolNames]) {
        const depNames = deps[name];
        if (depNames) {
          for (const dep of depNames) {
            if (!toolNameSet.has(dep)) {
              toolNameSet.add(dep);
              orderedToolNames.push(dep);
              dependencies.push({ toolName: dep, reason: `dependency_of:${name}` });
            }
          }
        }
      }

      const registryMap = new Map(routableTools.map((t) => [t.name, t]));
      const routingDecisions: RoutingPreviewRoutingDecision[] = [];

      const primaryName = selectPrimaryTool(rawMatches);
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
      const keptSet = new Set(kept);

      for (const name of orderedWithPrimaryFirst) {
        const tool = registryMap.get(name);
        if (!tool) continue;
        const isKept = keptSet.has(name);
        let reason: RoutingPreviewRoutingDecision['reason'];
        if (!isKept) reason = 'dropped_as_alternative';
        else if (name === primaryName) reason = 'primary';
        else if (explicitDeps.has(name)) reason = 'dependency';
        else reason = 'read_only';
        routingDecisions.push({ toolName: name, kept: isKept, reason });
      }

      const finalTools = kept.slice(0, maxTools);
      const directScoreByTool = new Map<string, RoutingPreviewMatch>();
      for (const m of matches) {
        const existing = directScoreByTool.get(m.toolName);
        if (!existing || m.similarity > existing.similarity) {
          directScoreByTool.set(m.toolName, m);
        }
      }
      const embeddingScores = await this.repository.scoreEmbeddingsForTools(embedding, finalTools);
      const embeddingScoreByTool = new Map(embeddingScores.map((score) => [score.toolName, score]));
      const finalToolScores = finalTools
        .map((toolName) => {
          const direct = directScoreByTool.get(toolName);
          if (direct) {
            return {
              ...direct,
              matchLevel: toolName === primaryName ? 'primary' as const : 'secondary' as const,
            };
          }
          const score = embeddingScoreByTool.get(toolName);
          return score
            ? {
              ...score,
              source: 'embeddings' as const,
              matchLevel: score.similarity >= similarityThreshold ? 'secondary' as const : 'below_threshold' as const,
            }
            : null;
        })
        .filter((score): score is NonNullable<typeof score> => score != null);

      return {
        query: userText, normalized, status: 'routed',
        matches, finalToolScores, dependencies, routingDecisions,
        confirmations: this.getConfirmations(finalTools),
        finalTools,
        config,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error?.('[chatbot-rag] Routing preview failed:', error);
      return {
        query: userText, normalized, status: 'router_error',
        matches: [], dependencies: [], routingDecisions: [], confirmations: [], finalTools: [],
        error: message, config,
      };
    }
  }

  private getConfirmations(toolNames: string[]): RoutingPreviewConfirmation[] {
    const registryMap = new Map(getRoutableTools(this.registry.tools).map((tool) => [tool.name, tool]));
    return toolNames
      .map((toolName): RoutingPreviewConfirmation | null => {
        const confirmation = registryMap.get(toolName)?.confirmation;
        if (!confirmation) return null;
        const preview: RoutingPreviewConfirmation = {
          toolName,
          level: confirmation.level ?? 'notice',
        };
        if (confirmation.message !== undefined) {
          preview.message = confirmation.message;
          preview.resolvedMessage = this.resolveI18nMessage(confirmation.message);
        }
        return preview;
      })
      .filter((confirmation): confirmation is RoutingPreviewConfirmation => confirmation != null);
  }

  private filterRegisteredMatches<T extends { toolName: string }>(
    matches: T[],
    registeredToolNames: Set<string>,
  ): T[] {
    return matches.filter((match) => registeredToolNames.has(match.toolName));
  }

  private resolveI18nMessage(message: string): string {
    try {
      const i18n = this.container?.get(Symbol.for('I18nService')) as { t?: (key: string) => string } | undefined;
      const translated = i18n?.t?.(message);
      return translated || message;
    } catch {
      return message;
    }
  }
}
