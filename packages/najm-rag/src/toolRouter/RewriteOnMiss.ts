import { EmbeddingLru } from '../embeddings/EmbeddingUtils';
import type { RoutingQueryRewriteOnMiss } from '../config';
import { normalizeQuery } from './ToolRouterUtils';

/** Time the app's miss rewrite (often an LLM call) may take before routing gives up on it. */
export const REWRITE_ON_MISS_TIMEOUT_MS = 1500;
const CACHE_SIZE = 256;

/** One cache per hook, shared by chat routing and the studio preview. */
const caches = new WeakMap<RoutingQueryRewriteOnMiss, EmbeddingLru<string | null>>();

/**
 * Runs `rewriteRoutingQueryOnMiss` for a message that matched no tool.
 * Returns the normalized rewrite, or null when there is no hook, it failed,
 * timed out, or returned nothing new. Successful answers (including "no
 * rewrite") are cached; failures are not, so the next message tries again.
 */
export async function rewriteOnMiss(
  hook: RoutingQueryRewriteOnMiss | undefined,
  normalized: string,
): Promise<string | null> {
  if (typeof hook !== 'function') return null;
  let cache = caches.get(hook);
  if (!cache) caches.set(hook, cache = new EmbeddingLru<string | null>(CACHE_SIZE));
  const cached = cache.get(normalized);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // Settle the race before aborting: a hook that answers on abort must not win.
        reject(new Error('rewriteRoutingQueryOnMiss timed out'));
        controller.abort();
      }, REWRITE_ON_MISS_TIMEOUT_MS);
    });
    const output = await Promise.race([Promise.resolve(hook(normalized, { signal: controller.signal })), timedOut]);
    const rewritten = typeof output === 'string' ? normalizeQuery(output) : '';
    const result = rewritten && rewritten !== normalized ? rewritten : null;
    cache.set(normalized, result);
    return result;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
