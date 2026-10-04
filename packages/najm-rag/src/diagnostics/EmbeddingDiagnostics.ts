import { AsyncLocalStorage } from 'node:async_hooks';

export type EmbeddingOperation = 'tool-routing' | 'routing-preview' | 'knowledge-search'
  | 'tool-index' | 'semantic-index' | 'document-index' | 'unspecified';
export type EmbeddingOutcome = 'completed' | 'timeout' | 'unavailable' | 'cooldown' | 'error';

export interface EmbeddingAttemptDiagnostic {
  /** Offset from this diagnostics scope's start, using a monotonic clock. */
  startMs: number;
  durationMs: number;
  inputCount: number;
  outcome: Exclude<EmbeddingOutcome, 'cooldown'>;
}

/** Counts and timings only: no input text, vectors, endpoint, credentials or error messages. */
export interface EmbeddingDiagnostic {
  version: 1;
  correlationId: string | null;
  operation: EmbeddingOperation;
  purpose: 'query' | 'document' | 'health';
  startMs: number;
  durationMs: number;
  inputCount: number;
  cache: 'hit' | 'miss' | 'bypass';
  provider: string | null;
  model: string | null;
  timeoutMs: number | null;
  outcome: EmbeddingOutcome;
  /** Actual HTTP requests (batch requests or health retries), not implied retries. */
  attempts: EmbeddingAttemptDiagnostic[];
}

export interface EmbeddingDiagnosticsOptions {
  correlationId?: string | null;
  /** Best effort; neither thrown errors nor rejected promises change embedding results. */
  onEmbedding: (event: EmbeddingDiagnostic) => void | Promise<void>;
}

export interface RagDiagnosticsRunner {
  run<T>(options: EmbeddingDiagnosticsOptions, work: () => T | Promise<T>): Promise<T>;
}

interface Scope extends EmbeddingDiagnosticsOptions { startedAt: number; closed: boolean }
const scopes = new AsyncLocalStorage<Scope>();
const round = (ms: number) => Math.round(ms * 10) / 10;

/** Correlates nested async embedding calls without a process-wide "current request". */
export async function withEmbeddingDiagnostics<T>(
  options: EmbeddingDiagnosticsOptions, work: () => T | Promise<T>,
): Promise<T> {
  const scope: Scope = { ...options, startedAt: performance.now(), closed: false };
  return scopes.run(scope, async () => {
    try { return await work(); }
    finally { scope.closed = true; }
  });
}

/** Internal per-call recorder. No recorder is allocated outside an active scope. */
export function startEmbeddingDiagnostic(
  init: Pick<EmbeddingDiagnostic, 'purpose' | 'operation' | 'inputCount' | 'cache'>,
) {
  const scope = scopes.getStore();
  if (!scope || scope.closed) return undefined;
  const startedAt = performance.now();
  const data: EmbeddingDiagnostic = {
    ...init, version: 1, correlationId: scope.correlationId ?? null,
    startMs: round(startedAt - scope.startedAt), durationMs: 0,
    provider: null, model: null, timeoutMs: null, outcome: 'completed', attempts: [],
  };
  return {
    data,
    attempt(start: number, inputCount: number, outcome: EmbeddingAttemptDiagnostic['outcome']) {
      data.attempts.push({ startMs: round(start - scope.startedAt),
        durationMs: round(performance.now() - start), inputCount, outcome });
    },
    fail() {
      data.outcome = data.attempts.at(-1)?.outcome ?? 'error';
      if (data.outcome === 'completed') data.outcome = 'error';
    },
    finish() {
      if (scope.closed) return;
      data.durationMs = round(performance.now() - startedAt);
      try { void Promise.resolve(scope.onEmbedding(data)).catch(() => {}); }
      catch { /* Diagnostics must not change an embedding result. */ }
    },
  };
}

export type EmbeddingDiagnosticRecorder = ReturnType<typeof startEmbeddingDiagnostic>;
