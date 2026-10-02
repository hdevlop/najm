import React from 'react';
import { Badge } from 'najm-kit';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { TestCase, TestResult } from '../types';

interface TestSubRowProps {
  test: TestCase;
  result: TestResult | null;
}

export function TestSubRow({ test, result }: TestSubRowProps) {
  if (!result) return null;
  return (
    <div className="bg-card/40 p-4">
      <div
        className={[
          'rounded-lg border p-4',
          result.status === 'pass'
            ? 'border-status-green/30 bg-status-green/5'
            : result.status === 'low_confidence'
              ? 'border-status-yellow/30 bg-status-yellow/5'
              : 'border-status-red/25 bg-status-red/5',
        ].join(' ')}
      >
        <div className="mb-4 flex items-start gap-3">
          {result.status === 'pass' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-status-green" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 text-status-red" />
          )}
          <div>
            <p
              className={
                result.status === 'pass'
                  ? 'text-sm font-semibold text-status-green'
                  : 'text-sm font-semibold text-status-red'
              }
            >
              {result.status === 'pass'
                ? 'All expected tools matched'
                : result.status === 'low_confidence'
                  ? 'Expected tools matched with low confidence'
                  : 'Expected tools missing'}
            </p>
            <p className="mt-1 text-xs text-txt-muted">
              {result.actualTools.length} actual tool{result.actualTools.length !== 1 ? 's' : ''} vs {test.expectedTools.length} expected
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-txt-muted">Routing Result</p>
          <div className="flex flex-wrap gap-2">
            {(result.scores.length > 0
              ? result.scores
              : result.actualTools.map((toolName) => ({
                  toolName,
                  similarity: 0,
                  matchLevel: 'below_threshold' as const,
                }))
            ).map((score) => (
              <div
                key={score.toolName}
                className={[
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs',
                  score.matchLevel === 'primary'
                    ? 'border-status-green/40 bg-status-green/5 text-txt-primary'
                    : score.matchLevel === 'secondary'
                      ? 'border-status-yellow/40 bg-status-yellow/5 text-txt-primary'
                      : 'border-border bg-bg text-txt-secondary',
                ].join(' ')}
              >
                <span className="font-semibold">{score.toolName}</span>
                <Badge
                  variant={score.matchLevel === 'primary' ? 'success' : score.matchLevel === 'secondary' ? 'warning' : 'outline'}
                  className="rounded px-1.5 py-0 text-[10px] uppercase"
                >
                  {score.matchLevel.replace('_', ' ')}
                </Badge>
                <span className="text-txt-muted">{Math.round(score.similarity * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
