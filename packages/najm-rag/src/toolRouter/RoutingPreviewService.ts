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
import { normalizeQuery, rewriteRoutingQuery } from './ToolRouterUtils';
import { ToolRoutingLoader } from './ToolRoutingLoader';
import { DEFAULT_SIMILARITY_THRESHOLD } from './RoutingDefaults';
import { getRoutableTools } from '../toolVisibility';
import { decideRouting } from './RoutingDecision';
import { rewriteOnMiss } from './RewriteOnMiss';

@Service()
export class RoutingPreviewService {
  @DI() private container!: Container;

  constructor(
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject() private registry: McpRegistryService,
    @Inject() private embedding: EmbeddingService,
    @Inject() private repository: ToolIndexRepository,
    @Inject(LoggerService) private log: LoggerService,
    @Inject() private provider: ToolRoutingLoader,
  ) {}

  async previewRouting(userText: string): Promise<RoutingPreviewResult> {
    const routing = await this.provider.getRoutingConfig();
    const routableTools = getRoutableTools(this.registry.tools);

    const maxTools = routing?.maxTools ?? 12;
    const topSemanticHits = routing?.topSemanticHits ?? 8;
    const similarityThreshold = routing?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
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

    const override = routing.toolsOverride === 'none' || routing.toolsOverride === 'all' ? routing.toolsOverride : null;
    if (override || !normalized) {
      const fallback = override ?? routing.fallbackOnNoMatch ?? 'none';
      return {
        query: userText, normalized,
        status: fallback === 'all' ? 'fallback_all' : 'fallback_none',
        matches: [], dependencies: [], routingDecisions: [], confirmations: this.getConfirmations(fallback === 'all' ? routableTools.map((t) => t.name) : []),
        finalTools: fallback === 'all' ? routableTools.map((t) => t.name) : [],
        config,
      };
    }

    // Shown only when the app's rewrite changed what was embedded.
    let shown: { rewritten?: string; rewrittenOnMiss?: string } = {};
    try {
      const rewritten = rewriteRoutingQuery(normalized, this.config.rewriteRoutingQuery);
      if (rewritten !== normalized) shown = { rewritten };
      let embedding = await this.embedding.embed(rewritten, 'query', 'routing-preview');

      const settings = { maxTools, topSemanticHits, similarityThreshold, dependencies: routing.dependencies ?? {} };
      let decision = await decideRouting(embedding, routableTools, this.repository, settings);

      // Same second pass as chat routing (ToolRouterService).
      if (decision.miss) {
        const second = await rewriteOnMiss(this.config.rewriteRoutingQueryOnMiss, normalized);
        if (second) {
          const secondEmbedding = await this.embedding.embed(second, 'query', 'routing-preview');
          const secondDecision = await decideRouting(secondEmbedding, routableTools, this.repository, settings);
          if (!secondDecision.miss) {
            embedding = secondEmbedding;
            decision = secondDecision;
            shown = { ...shown, rewrittenOnMiss: second };
          }
        }
      }

      if (decision.miss) {
        const fallback = routing.fallbackOnNoMatch ?? 'none';
        return {
          query: userText, normalized, ...shown,
          status: fallback === 'all' ? 'fallback_all' : 'fallback_none',
          matches: [], dependencies: [], routingDecisions: [], confirmations: this.getConfirmations(fallback === 'all' ? routableTools.map((t) => t.name) : []),
          finalTools: fallback === 'all' ? routableTools.map((t) => t.name) : [],
          config,
        };
      }

      const { matches, primaryName, dependencies, routingDecisions } = decision;
      const finalTools = decision.finalTools.map((tool) => tool.name);
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
        query: userText, normalized, ...shown, status: 'routed',
        matches, finalToolScores, dependencies, routingDecisions,
        confirmations: this.getConfirmations(finalTools),
        finalTools,
        config,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error?.('[chatbot-rag] Routing preview failed:', error);
      return {
        query: userText, normalized, ...shown, status: 'router_error',
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
