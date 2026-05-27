import type { RegisteredTool } from 'najm-mcp';

export interface MatchEntry {
  toolName: string;
  similarity: number;
}

export function isWriteTool(tool: RegisteredTool): boolean {
  return tool.annotations?.readOnlyHint !== true;
}

/**
 * Aggregate per-tool similarity to pick the primary, instead of trusting matches[0].
 * A single noisy phrase shouldn't outvote a cluster of strong matches on another tool.
 * - sum top-K (K=3) similarities per tool
 * - tiebreak (within ε) by hit count, then by best single score
 */
export function selectPrimaryTool(matches: MatchEntry[]): string | undefined {
  if (matches.length === 0) return undefined;
  const TOP_K = 3;
  const TIE_EPS = 0.02;

  const byTool = new Map<string, number[]>();
  for (const m of matches) {
    const arr = byTool.get(m.toolName) ?? [];
    arr.push(m.similarity);
    byTool.set(m.toolName, arr);
  }

  const aggregates = [...byTool.entries()].map(([toolName, sims]) => {
    sims.sort((a, b) => b - a);
    const topK = sims.slice(0, TOP_K);
    const sum = topK.reduce((acc, s) => acc + s, 0);
    return { toolName, sum, count: sims.length, best: sims[0] };
  });

  aggregates.sort((a, b) => {
    if (Math.abs(a.sum - b.sum) > TIE_EPS) return b.sum - a.sum;
    if (a.count !== b.count) return b.count - a.count;
    return b.best - a.best;
  });

  return aggregates[0]?.toolName;
}

export function filterAlternativeMutations(
  toolNames: string[],
  primaryName: string | undefined,
  explicitDeps: Set<string>,
  registryMap: Map<string, RegisteredTool>,
): string[] {
  if (!primaryName) return [...toolNames];

  const result: string[] = [];
  for (const name of toolNames) {
    if (name === primaryName || explicitDeps.has(name)) {
      result.push(name);
      continue;
    }
    const tool = registryMap.get(name);
    if (!tool) continue;
    if (isWriteTool(tool)) continue;
    result.push(name);
  }
  return result;
}
