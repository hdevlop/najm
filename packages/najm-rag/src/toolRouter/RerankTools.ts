import type { RegisteredTool } from 'najm-mcp';
import type { RoutingRerankConfig, RoutingRerankPick } from '../config';
import { EmbeddingLru } from '../embeddings/EmbeddingUtils';
import type { RoutingPreviewMatch, RoutingRerankOutcome } from './ToolRouterDto';

/** Time the app's reranker may take before routing keeps its own order. */
export const DEFAULT_RERANK_TIMEOUT_MS = 800;
export const DEFAULT_RERANK_SELECT_AT = 0.85;
export const DEFAULT_RERANK_PROMOTE_AT = 0.7;
export const DEFAULT_RERANK_KEEP_ROUTER_TOOLS = 3;
const CACHE_SIZE = 256;

/** One cache per hook, shared by chat routing and the studio preview. */
const caches = new WeakMap<RoutingRerankConfig['rerank'], EmbeddingLru<RoutingRerankPick>>();

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * Asks the app's reranker which candidate fits the message. Returns null when
 * it failed, timed out, or answered something that is not one of the
 * candidates (or null for none) with a confidence between 0 and 1. Valid
 * answers are cached; failures are not, so the next message tries again.
 */
export async function askReranker(
  config: RoutingRerankConfig,
  query: string,
  candidates: Array<{ toolName: string; description: string; similarity: number }>,
): Promise<RoutingRerankPick | null> {
  const hook = config.rerank;
  let cache = caches.get(hook);
  if (!cache) caches.set(hook, cache = new EmbeddingLru<RoutingRerankPick>(CACHE_SIZE));
  const key = `${query}\u0000${candidates.map((candidate) => candidate.toolName).join('\u0000')}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // Settle the race before aborting: a hook that answers on abort must not win.
        reject(new Error('rerankTools timed out'));
        controller.abort();
      }, config.timeoutMs ?? DEFAULT_RERANK_TIMEOUT_MS);
    });
    const answer = await Promise.race([
      Promise.resolve(hook({ query, candidates, signal: controller.signal })),
      timedOut,
    ]);
    if (!answer || !isConfidence(answer.confidence)) return null;
    const toolName = answer.toolName ?? null;
    if (toolName !== null && !candidates.some((candidate) => candidate.toolName === toolName)) return null;
    const pick = { toolName, confidence: answer.confidence };
    cache.set(key, pick);
    return pick;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reorders or shortens the router's matches by the reranker's pick.
 *   confidence >= selectAt:  the pick, then `keepRouterTools` of the router's
 *                            matches; a near miss is rescued only here.
 *   confidence >= promoteAt: the pick moves to the top of the router's matches.
 *   anything else:           the router's order.
 */
export async function rerankMatches(
  config: RoutingRerankConfig,
  query: string,
  ranked: RoutingPreviewMatch[],
  matches: RoutingPreviewMatch[],
  routableTools: RegisteredTool[],
  settings: { threshold: number; topSemanticHits: number },
): Promise<{ matches: RoutingPreviewMatch[]; outcome: RoutingRerankOutcome } | null> {
  const floor = Math.min(config.minSimilarity ?? settings.threshold, settings.threshold);
  const candidates = ranked.filter((match) => match.similarity >= floor).slice(0, Math.max(settings.topSemanticHits, 1));
  if (candidates.length === 0) return null;

  const descriptions = new Map(routableTools.map((tool) => [tool.name, tool.description ?? '']));
  const pick = await askReranker(config, query, candidates.map((candidate) => ({
    toolName: candidate.toolName,
    description: descriptions.get(candidate.toolName) ?? '',
    similarity: candidate.similarity,
  })));
  const unchanged = { matches, outcome: { pick, applied: 'unchanged' as const, candidates: candidates.length } };
  if (!pick?.toolName) return unchanged;

  const picked = candidates.find((candidate) => candidate.toolName === pick.toolName)!;
  const others = matches.filter((match) => match.toolName !== picked.toolName);
  const selectAt = config.selectAt ?? DEFAULT_RERANK_SELECT_AT;
  const promoteAt = config.promoteAt ?? DEFAULT_RERANK_PROMOTE_AT;
  if (pick.confidence >= selectAt) {
    const keep = Math.max(config.keepRouterTools ?? DEFAULT_RERANK_KEEP_ROUTER_TOOLS, 0);
    return { matches: [picked, ...others.slice(0, keep)], outcome: { ...unchanged.outcome, applied: 'selected' } };
  }
  if (pick.confidence >= promoteAt && picked.similarity >= settings.threshold) {
    return { matches: [picked, ...others], outcome: { ...unchanged.outcome, applied: 'promoted' } };
  }
  return unchanged;
}
