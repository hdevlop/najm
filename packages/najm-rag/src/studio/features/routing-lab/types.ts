// owner: routing-lab

import type { RoutingPreviewResult } from './routing-semantics/types';

export interface RoutingLabState {
  query: string;
  loading: boolean;
  result: RoutingPreviewResult | null;
  error: string | null;
  elapsedMs: number | null;
}

export interface LabVisibleData {
  finalTools: string[];
  matches: RoutingPreviewResult['matches'];
  finalToolScores: RoutingPreviewResult['finalToolScores'];
  dependencies: RoutingPreviewResult['dependencies'];
  routingDecisions: RoutingPreviewResult['routingDecisions'];
  confirmations: RoutingPreviewResult['confirmations'];
  visibleDependencies: RoutingPreviewResult['dependencies'];
  matchByTool: Map<string, RoutingPreviewResult['matches'][number]>;
  scoreByTool: Map<string, RoutingPreviewResult['finalToolScores'][number] | RoutingPreviewResult['matches'][number]>;
  confirmationByTool: Map<string, RoutingPreviewResult['confirmations'][number]>;
  finalToolSet: Set<string>;
}

export function buildLabVisibleData(result: RoutingPreviewResult | null): LabVisibleData | null {
  if (!result) return null;
  const finalTools = result.finalTools ?? [];
  const matches = result.matches ?? [];
  const finalToolScores = result.finalToolScores ?? [];
  const dependencies = result.dependencies ?? [];
  const routingDecisions = result.routingDecisions ?? [];
  const confirmations = result.confirmations ?? [];

  const matchByTool = new Map(matches.map((m) => [m.toolName, m]));
  const scoreByTool = new Map(finalToolScores.map((s) => [s.toolName, s]));
  const confirmationByTool = new Map(confirmations.map((c) => [c.toolName, c]));
  const finalToolSet = new Set(finalTools);
  const visibleDependencies = dependencies.filter((d) => finalToolSet.has(d.toolName));

  return {
    finalTools, matches, finalToolScores, dependencies, routingDecisions, confirmations,
    visibleDependencies, matchByTool, scoreByTool, confirmationByTool, finalToolSet,
  };
}

// Cross-feature re-exports
export type { RoutingPreviewResult } from './routing-semantics/types';
export type { JsonViewColors } from './routing-tools/types';