import type { RegisteredTool } from 'najm-mcp';
import type { SemanticMatch } from '../toolIndex';
import type { RoutingPreviewDependency, RoutingPreviewMatch, RoutingPreviewRoutingDecision } from './ToolRouterDto';
import { filterAlternativeMutations } from './RoutingLogic';

/** Phrase rows fetched per tool kept, so tools are ranked from enough rows. */
const PHRASE_ROWS_PER_TOOL = 5;

export interface RoutingSearch {
  searchSemantics(embedding: number[], limit: number, threshold: number): Promise<SemanticMatch[]>;
  searchEmbeddings(embedding: number[], limit: number, threshold: number): Promise<SemanticMatch[]>;
}

export interface RoutingDecisionSettings {
  maxTools: number;
  topSemanticHits: number;
  similarityThreshold: number;
  dependencies: Record<string, string[]>;
}

/** Everything chat routing decided for one query, and why. */
export interface RoutingDecision {
  /**
   * One per tool at or above the threshold, best first, scored by the better
   * of the tool's best phrase and its description (`source` says which).
   */
  matches: RoutingPreviewMatch[];
  /**
   * Best score seen below the threshold when nothing matched, and the tool
   * it belongs to (null when nothing was indexed); recorded in the unmatched inbox.
   */
  miss: { score: number; toolName: string | null; source: 'low_confidence' | 'no_match' } | null;
  primaryName: string | undefined;
  dependencies: RoutingPreviewDependency[];
  routingDecisions: RoutingPreviewRoutingDecision[];
  /** The tools given to the model, in order. */
  finalTools: RegisteredTool[];
}

/**
 * The routing pipeline shared by chat (`ToolRouterService`) and the studio
 * preview (`RoutingPreviewService`), so a routing test measures what chat does.
 */
export async function decideRouting(
  embedding: number[],
  routableTools: RegisteredTool[],
  search: RoutingSearch,
  settings: RoutingDecisionSettings,
): Promise<RoutingDecision> {
  const { maxTools, topSemanticHits, similarityThreshold: threshold } = settings;
  const registered = new Set(routableTools.map((tool) => tool.name));
  const onlyRegistered = (matches: SemanticMatch[]) => matches.filter((match) => registered.has(match.toolName));

  // Tools are ranked, not phrase rows: a tool with many phrases would
  // otherwise fill the list. Phrases and descriptions are searched together
  // and a tool scores the better of the two, so a tool without phrases is not
  // shut out by a weak phrase hit on another tool. Probing at threshold 0 lets
  // a miss record the best score below the threshold.
  const probeLimit = Math.max(topSemanticHits, 1) * PHRASE_ROWS_PER_TOOL;
  const [rawSemantics, rawEmbeddings] = await Promise.all([
    search.searchSemantics(embedding, probeLimit, 0).then(onlyRegistered),
    search.searchEmbeddings(embedding, probeLimit, 0).then(onlyRegistered),
  ]);
  const best = new Map<string, RoutingPreviewMatch>();
  const consider = (rows: SemanticMatch[], source: RoutingPreviewMatch['source']) => {
    for (const row of rows) {
      const current = best.get(row.toolName);
      if (!current || row.similarity > current.similarity) best.set(row.toolName, { ...row, source });
    }
  };
  consider(rawSemantics, 'semantics');
  consider(rawEmbeddings, 'embeddings');
  const ranked = [...best.values()].sort((a, b) => b.similarity - a.similarity);
  const matches = ranked.filter((match) => match.similarity >= threshold).slice(0, Math.max(topSemanticHits, 1));

  if (matches.length === 0) {
    return {
      matches: [],
      miss: {
        score: ranked[0]?.similarity ?? 0,
        toolName: ranked[0]?.toolName ?? null,
        source: ranked.length > 0 ? 'low_confidence' : 'no_match',
      },
      primaryName: undefined,
      dependencies: [],
      routingDecisions: [],
      finalTools: [],
    };
  }

  // Dependencies are followed transitively: a dependency's own dependencies join too.
  const deps = settings.dependencies ?? {};
  const toolNameSet = new Set(matches.map((match) => match.toolName));
  const orderedToolNames = [...toolNameSet];
  const dependencies: RoutingPreviewDependency[] = [];
  for (let i = 0; i < orderedToolNames.length; i++) {
    const name = orderedToolNames[i];
    for (const dep of deps[name] ?? []) {
      if (toolNameSet.has(dep)) continue;
      toolNameSet.add(dep);
      orderedToolNames.push(dep);
      dependencies.push({ toolName: dep, reason: `dependency_of:${name}` });
    }
  }

  const registryMap = new Map(routableTools.map((tool) => [tool.name, tool]));
  // The best-scoring tool. Summing each tool's top three phrases instead
  // favoured tools with many phrases and scored 8 points lower on the
  // routing benchmark.
  const primaryName = matches[0]?.toolName;
  const explicitDeps = new Set<string>(primaryName ? deps[primaryName] ?? [] : []);
  const ordered = primaryName
    ? [primaryName, ...orderedToolNames.filter((name) => name !== primaryName)]
    : orderedToolNames;
  const kept = filterAlternativeMutations(ordered, primaryName, explicitDeps, registryMap);
  const keptSet = new Set(kept);

  const routingDecisions: RoutingPreviewRoutingDecision[] = [];
  for (const name of ordered) {
    if (!registryMap.has(name)) continue;
    const isKept = keptSet.has(name);
    const reason: RoutingPreviewRoutingDecision['reason'] = !isKept ? 'dropped_as_alternative'
      : name === primaryName ? 'primary'
        : explicitDeps.has(name) ? 'dependency'
          : 'read_only';
    routingDecisions.push({ toolName: name, kept: isKept, reason });
  }

  const finalTools = kept.slice(0, maxTools)
    .map((name) => registryMap.get(name))
    .filter((tool): tool is RegisteredTool => tool !== undefined);

  return { matches, miss: null, primaryName, dependencies, routingDecisions, finalTools };
}
