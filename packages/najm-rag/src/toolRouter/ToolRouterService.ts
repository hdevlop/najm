import { Service, Meta, Inject, LoggerService } from 'najm-core';
import { McpRegistryService, type RegisteredTool } from 'najm-mcp';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from '../toolIndex';
import type { ToolRouterResult, ToolRoutingRequest } from './ToolRouterDto';
import { normalizeQuery, rewriteRoutingQuery } from './ToolRouterUtils';
import { ToolRoutingLoader } from './ToolRoutingLoader';
import { UnmatchedQueryService } from '../unmatched';
import type { UnmatchedMiss } from '../unmatched/UnmatchedQueryDto';
import { getRoutableTools } from '../toolVisibility';
import { decideRouting, type RoutingDecision, type RoutingDecisionSettings, type RoutingRerank } from './RoutingDecision';

const withRerank = (decision: RoutingDecision) => (decision.rerank ? { rerank: decision.rerank } : {});
import { rewriteOnMiss } from './RewriteOnMiss';
import { DEFAULT_SIMILARITY_THRESHOLD } from './RoutingDefaults';

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

  private pendingWrites = new Set<Promise<void>>();

  /** Resolves once miss records started so far are written (or failed). For tests and shutdown. */
  async settled(): Promise<void> {
    await Promise.allSettled([...this.pendingWrites]);
  }

  /**
   * `userText` may join several turns; `request.latestUserText` is the
   * user's latest message on its own. The latest message is routed first and
   * is what the unmatched inbox records; the joined turns are routed only
   * when it matches nothing.
   */
  async findRelevantTools(userText: string, request?: ToolRoutingRequest): Promise<ToolRouterResult> {
    const routing = await this.provider.getRoutingConfig();
    const routableTools = getRoutableTools(this.registry.tools);
    if (!routing || routing.enabled !== true) {
      return { status: 'disabled', tools: routableTools };
    }

    if (routing.toolsOverride === 'none' || routing.toolsOverride === 'all') {
      return this.applyFallbackResult(routing.toolsOverride);
    }

    const normalized = normalizeQuery(userText);
    if (!normalized) {
      return this.applyFallbackResult(routing.fallbackOnNoMatch ?? 'none');
    }
    // The latest message is routed first; the joined turns only when it
    // matches nothing, as for a bare "yes" that answers a question.
    const latestText = request?.latestUserText?.trim() ? request.latestUserText : userText;
    const latest = normalizeQuery(latestText) || normalized;

    try {
      const [latestEmbedding, joinedEmbedding] = await this.embedRoutingQueries(latest, normalized);

      const threshold = routing.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
      const settings = {
        maxTools: routing.maxTools ?? 12,
        topSemanticHits: routing.topSemanticHits ?? 8,
        similarityThreshold: threshold,
        dependencies: routing.dependencies ?? {},
      };
      let decision = await decideRouting(latestEmbedding, routableTools, this.repository, settings, this.rerankFor(latest));
      // The reranker said no tool fits (`dropAt`): no retry, no unmatched record.
      if (decision.dropped) return { status: 'fallback_none', tools: [], ...withRerank(decision) };
      if (decision.miss && joinedEmbedding) {
        const joined = await decideRouting(joinedEmbedding, routableTools, this.repository, settings, this.rerankFor(normalized));
        if (!joined.miss) decision = joined;
      }

      if (decision.miss) {
        const second = await this.routeRewrittenMiss(latest, routableTools, settings);
        if (second) return { status: 'routed', tools: second.finalTools, rewrittenOnMiss: true, ...withRerank(second) };
        this.recordUnmatchedQuery({
          query: latestText,
          normalized: latest,
          score: decision.miss.score,
          threshold,
          source: decision.miss.source,
          nearestTool: decision.miss.toolName,
        });
        return { ...this.applyFallbackResult(routing.fallbackOnNoMatch ?? 'none'), ...withRerank(decision) };
      }

      return { status: 'routed', tools: decision.finalTools, ...withRerank(decision) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error?.('[chatbot-rag] Tool routing failed:', error);
      const fallback = routing.fallbackOnRouterError ?? 'all';
      return { status: 'router_error', tools: fallback === 'all' ? routableTools : [], error: message };
    }
  }

  private rerankFor(query: string): RoutingRerank | undefined {
    return this.config.rerankTools ? { config: this.config.rerankTools, query } : undefined;
  }

  /**
   * The second pass for a miss (`rewriteRoutingQueryOnMiss`). Returns the
   * decision when the rewritten message matched; any failure keeps the miss.
   */
  private async routeRewrittenMiss(
    normalized: string,
    routableTools: RegisteredTool[],
    settings: RoutingDecisionSettings,
  ): Promise<RoutingDecision | null> {
    const rewritten = await rewriteOnMiss(this.config.rewriteRoutingQueryOnMiss, normalized);
    if (!rewritten) return null;
    try {
      const embedding = await this.embedding.embed(rewritten, 'query', 'tool-routing');
      const decision = await decideRouting(embedding, routableTools, this.repository, settings, this.rerankFor(rewritten));
      return decision.miss ? null : decision;
    } catch (error) {
      this.log.warn?.('[chatbot-rag] Routing the rewritten message failed:', error);
      return null;
    }
  }

  /**
   * One request for every text this message needs: the latest message and,
   * when it differs, the joined turns, both as routing embeds them (rewritten),
   * plus the unrewritten joined text knowledge search embeds, so that lookup
   * is a cache hit. Returns null for the joined turns when they are the
   * latest message.
   */
  private async embedRoutingQueries(latest: string, joined: string): Promise<[number[], number[] | null]> {
    const rewrite = this.config.rewriteRoutingQuery;
    const latestText = rewriteRoutingQuery(latest, rewrite);
    const joinedText = joined === latest ? null : rewriteRoutingQuery(joined, rewrite);
    const texts = [latestText];
    if (joinedText && joinedText !== latestText) texts.push(joinedText);
    if (this.config.knowledge?.enabled === true && !texts.includes(joined)) texts.push(joined);
    if (texts.length === 1) return [await this.embedding.embed(latestText, 'query', 'tool-routing'), null];
    const vectors = await this.embedding.embedQueries(texts, 'tool-routing');
    const joinedVector = joinedText ? vectors[texts.indexOf(joinedText)] : null;
    return [vectors[0], joinedVector ?? null];
  }

  private applyFallbackResult(fallback: 'all' | 'none'): ToolRouterResult {
    if (fallback === 'all') return { status: 'fallback_all', tools: getRoutableTools(this.registry.tools) };
    return { status: 'fallback_none', tools: [] };
  }

  /** Written in the background: a miss is often small talk and must not wait for the database. */
  private recordUnmatchedQuery(miss: UnmatchedMiss): void {
    if (!this.unmatched) return;
    const write = Promise.resolve()
      .then(() => this.unmatched!.recordMiss(miss))
      .catch((err) => { this.log.warn?.('[chatbot-rag] Failed to record unmatched query:', err); })
      .finally(() => { this.pendingWrites.delete(write); });
    this.pendingWrites.add(write);
  }
}
