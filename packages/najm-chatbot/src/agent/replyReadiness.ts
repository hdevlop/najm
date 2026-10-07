import type { ReplyPreparationPolicy, ReplyPreparationRequest, ReplyPreparationSelection, ReplyTemplate } from './replyPolicy';

/** Start both paths once. No grace period is added to ready model preparation. */
export async function selectReplyPreparation<T>(options: {
  policy: ReplyPreparationPolicy;
  request: Omit<ReplyPreparationRequest, 'signal'>;
  signal?: AbortSignal;
  valid: (template: ReplyTemplate) => boolean;
  ordinary: (signal: AbortSignal) => Promise<T>;
  onSelection?: (event: ReplyPreparationSelection) => void;
}): Promise<{ kind: 'ordinary'; value: T } | { kind: 'template'; value: ReplyTemplate }> {
  const candidate = new AbortController();
  const ordinary = new AbortController();
  const request = { ...options.request, signal: candidate.signal };
  let eligible = false;
  try {
    const result = options.policy.eligible(request);
    eligible = result === true;
    // A mistaken async gate must neither authorize work nor leak a rejection.
    if (result && typeof (result as any).then === 'function') void Promise.resolve(result).catch(() => {});
  } catch { /* decline */ }
  const lifetime = new AbortController();
  const abort = () => lifetime.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let candidateState: ReplyPreparationSelection['candidateState'] = eligible ? 'pending' : 'not_started';
  try {
    lifetime.signal.throwIfAborted();
    const aborted = new Promise<never>((_, reject) => {
      lifetime.signal.addEventListener('abort', () => {
        candidate.abort(lifetime.signal.reason);
        ordinary.abort(lifetime.signal.reason);
        reject(lifetime.signal.reason);
      }, { once: true });
    });
    // Invoke the factory before ordinary preparation so immediate candidates
    // can win, but never execute tools until selection is final.
    const started = performance.now();
    const prepared = eligible ? Promise.resolve().then(() => {
      candidate.signal.throwIfAborted();
      return options.policy.prepare(request);
    }).then(value => {
      notify(value ? 'candidate' : 'declined');
      try { return value && !candidate.signal.aborted && options.valid(value) ? value : null; }
      catch { return null; }
    }, () => { notify('error'); return null; }) : Promise.resolve(null);
    function notify(outcome: 'candidate' | 'declined' | 'error') {
      candidateState = outcome;
      try { void Promise.resolve(options.policy.onSettled?.({ outcome,
        elapsedMs: performance.now() - started, aborted: candidate.signal.aborted })).catch(() => {}); }
      catch { /* observational sink */ }
    }
    const normal = Promise.resolve().then(() => {
      ordinary.signal.throwIfAborted();
      return options.ordinary(ordinary.signal);
    })
      .then(value => ({ kind: 'ordinary' as const, value }));
    const selected = (winner: { kind: 'ordinary'; value: T } | { kind: 'template'; value: ReplyTemplate }) => {
      const event: ReplyPreparationSelection = { selected: winner.kind, elapsedMs: performance.now() - started,
        timedOut, candidateState, losingWorkMayContinue: eligible, externalCost: 'unreported' };
      options.onSelection?.(event);
      try { void Promise.resolve(options.policy.onSelection?.({ ...event })).catch(() => {}); }
      catch { /* observational sink */ }
      return winner;
    };
    if (!eligible) return selected(await Promise.race([normal, aborted]));
    const configured = options.policy.timeoutMs ?? 800;
    const timeout = Number.isFinite(configured) && configured > 0 ? configured : 800;
    const expired = new Promise<null>(resolve => {
      timer = setTimeout(() => { timedOut = true; candidate.abort(); resolve(null); }, timeout);
    });
    const fast = Promise.race([prepared, expired]).then(value => value
      ? { kind: 'template' as const, value } : normal);
    const winner = await Promise.race([normal, fast, aborted]);
    if (winner.kind === 'template') ordinary.abort();
    else candidate.abort();
    return selected(winner);
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    candidate.abort();
    ordinary.abort();
  }
}
