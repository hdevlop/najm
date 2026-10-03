import type { RoutingStatus } from '../chatLogs';
import type { UsageCost } from './modelPricing';

/**
 * How one chat request ended. Exactly one is recorded per request, including
 * requests that fail before the model is called.
 * - `completed`: the model finished (any finish reason, including `length`).
 * - `error`: the provider stream errored, including a stall timeout.
 * - `aborted`: the stream was aborted before it finished.
 * - `setup_error`: settings, history, routing or context preparation threw.
 */
export type ChatOutcome = 'completed' | 'error' | 'aborted' | 'setup_error';

/** `executed` reached the tool; `blocked` was refused by the read-only adapter; `error` is a tool error result. */
export type ChatToolOutcome = 'executed' | 'blocked' | 'error';

export interface ChatToolSpan {
  name: string;
  toolCallId: string | null;
  outcome: ChatToolOutcome;
  /** Offset from the request start. */
  startMs: number;
  durationMs: number;
  /** Sizes only: arguments and results are not copied into diagnostics. */
  inputChars: number;
  resultChars: number;
}

export interface ChatStepSpan {
  /** Offset from the request start. A step includes its tool executions. */
  endMs: number;
  finishReason: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  toolCalls: string[];
}

export interface ChatUsageSummary {
  /** `total` is the SDK's aggregate across steps; `steps` is a sum of finished steps when no aggregate was reported. */
  source: 'total' | 'steps';
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}

/** Durations of preparation stages. `prepareMs` contains `routingMs` and `contextMs`; do not add them. */
export interface ChatPreparationSpans {
  settingsMs: number | null;
  historyMs: number | null;
  routingMs: number | null;
  contextMs: number | null;
  prepareMs: number | null;
  persistenceMs: number | null;
}

export interface ChatDiagnostics {
  version: 1;
  correlationId: string | null;
  channel: string;
  provider: string | null;
  model: string | null;
  outcome: ChatOutcome;
  error: string | null;
  routingStatus: RoutingStatus | null;
  routedToolCount: number;
  messages: { stored: number; prompt: number };
  spans: ChatPreparationSpans;
  /** Offsets from the request start: first non-empty answer text, and the end of generation. */
  marks: { firstTextMs: number | null; finishMs: number | null };
  steps: ChatStepSpan[];
  tools: ChatToolSpan[];
  usage: ChatUsageSummary | null;
  cost: (UsageCost & { provider: string; model: string }) | null;
}

export type ChatDiagnosticsSink = (diagnostics: ChatDiagnostics) => void | Promise<void>;

const MAX_ERROR_CHARS = 500;

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sum(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

export function describeError(error: unknown): string {
  const text = error instanceof Error
    ? `${error.name}: ${error.message}`
    : typeof error === 'string' ? error : JSON.stringify(error) ?? String(error);
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text;
}

/** Reads AI SDK v6 usage, keeping unreported counts as null rather than zero. */
export function summarizeUsage(usage: any, source: ChatUsageSummary['source'] = 'total'): ChatUsageSummary | null {
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = count(usage.inputTokens ?? usage.promptTokens);
  const outputTokens = count(usage.outputTokens ?? usage.completionTokens);
  const summary: ChatUsageSummary = {
    source,
    inputTokens,
    outputTokens,
    totalTokens: count(usage.totalTokens) ?? sum([inputTokens, outputTokens]),
    cachedInputTokens: count(usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens),
    reasoningTokens: count(usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens),
  };
  return summary.inputTokens === null && summary.outputTokens === null ? null : summary;
}

/**
 * Collects one request's timings with a monotonic clock. Every offset is
 * relative to the moment the request reached the agent.
 */
export class ChatDiagnosticsRecorder {
  private readonly startedAt = performance.now();
  private settled = false;
  readonly data: ChatDiagnostics;

  constructor(init: { channel: string; correlationId: string | null }) {
    this.data = {
      version: 1,
      correlationId: init.correlationId,
      channel: init.channel,
      provider: null,
      model: null,
      outcome: 'completed',
      error: null,
      routingStatus: null,
      routedToolCount: 0,
      messages: { stored: 0, prompt: 0 },
      spans: {
        settingsMs: null,
        historyMs: null,
        routingMs: null,
        contextMs: null,
        prepareMs: null,
        persistenceMs: null,
      },
      marks: { firstTextMs: null, finishMs: null },
      steps: [],
      tools: [],
      usage: null,
      cost: null,
    };
  }

  now(): number {
    return round(performance.now() - this.startedAt);
  }

  async span<T>(name: keyof ChatPreparationSpans, run: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    try {
      return await run();
    } finally {
      this.data.spans[name] = round(performance.now() - start);
    }
  }

  textDelta(text: string | undefined): void {
    if (this.data.marks.firstTextMs === null && text && text.trim()) {
      this.data.marks.firstTextMs = this.now();
    }
  }

  step(step: any): void {
    this.data.steps.push({
      endMs: this.now(),
      finishReason: step?.finishReason ?? null,
      inputTokens: count(step?.usage?.inputTokens),
      outputTokens: count(step?.usage?.outputTokens),
      toolCalls: (step?.toolCalls ?? [])
        .map((call: any) => call?.toolName ?? call?.name)
        .filter(Boolean),
    });
  }

  tool(span: Omit<ChatToolSpan, 'startMs' | 'durationMs'> & { start: number; end: number }): void {
    const { start, end, ...rest } = span;
    this.data.tools.push({
      ...rest,
      startMs: round(start - this.startedAt),
      durationMs: round(end - start),
    });
  }

  /** Sums finished steps when the SDK reported no aggregate (aborts and errors). */
  usageFromSteps(): ChatUsageSummary | null {
    if (!this.data.steps.length) return null;
    const inputTokens = sum(this.data.steps.map((step) => step.inputTokens));
    const outputTokens = sum(this.data.steps.map((step) => step.outputTokens));
    if (inputTokens === null && outputTokens === null) return null;
    return {
      source: 'steps',
      inputTokens,
      outputTokens,
      totalTokens: sum([inputTokens, outputTokens]),
      cachedInputTokens: null,
      reasoningTokens: null,
    };
  }

  /** Records the terminal outcome. Returns false when one was already recorded. */
  settle(outcome: ChatOutcome, error?: unknown): boolean {
    if (this.settled) return false;
    this.settled = true;
    this.data.outcome = outcome;
    this.data.error = error === undefined ? null : describeError(error);
    if (this.data.marks.finishMs === null && outcome !== 'setup_error') {
      this.data.marks.finishMs = this.now();
    }
    if (!this.data.usage) this.data.usage = this.usageFromSteps();
    return true;
  }
}
