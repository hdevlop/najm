import type { RoutingPreviewResult } from '@/features/routing-semantics/types';
import type { TestResult } from '../types';

export type { TestResult };

const CONFIDENCE_THRESHOLD = 60;

export function buildResult(expectedTools: string[], preview: RoutingPreviewResult): TestResult {
  const actualTools = preview.finalTools?.length
    ? preview.finalTools
    : preview.matches.map((match) => match.toolName);
  const actualSet = new Set(actualTools);
  const missingTools = expectedTools.filter((tool) => !actualSet.has(tool));
  const scores = (preview.finalToolScores ?? preview.matches.map((match, index) => ({
    ...match,
    matchLevel: index === 0 ? 'primary' as const : 'secondary' as const,
  }))).map((score) => ({
    toolName: score.toolName,
    similarity: score.similarity,
    matchLevel: 'matchLevel' in score ? score.matchLevel : 'secondary',
  }));
  const scoreByTool = new Map(scores.map((score) => [score.toolName, score]));
  const expectedScores = expectedTools
    .map((tool) => scoreByTool.get(tool))
    .filter((score): score is TestResult['scores'][number] => Boolean(score));
  const confidence = expectedScores.length > 0
    ? Math.round(Math.min(...expectedScores.map((score) => score.similarity)) * 100)
    : Math.round((scores[0]?.similarity ?? 0) * 100);
  const hasLowConfidence = expectedScores.some((score) => Math.round(score.similarity * 100) < CONFIDENCE_THRESHOLD);

  if (missingTools.length > 0) {
    return { actualTools, confidence, status: 'fail', missingTools, scores };
  }

  if (hasLowConfidence) {
    return { actualTools, confidence, status: 'low_confidence', missingTools, scores };
  }

  return { actualTools, confidence, status: 'pass', missingTools, scores };
}
