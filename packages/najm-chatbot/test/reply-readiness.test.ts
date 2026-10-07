import { expect, mock, test } from 'bun:test';
import { selectReplyPreparation } from '../src/agent/replyReadiness';
import type { ReplyPreparationPolicy, ReplyTemplate } from '../src/agent/replyPolicy';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const request = { userText: 'Bonjour', language: 'fr' as const, channel: 'web', userId: 'admin',
  historyComplete: true, priorUserTurns: 0 };
const ticks = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function fixture(extra: Partial<ReplyPreparationPolicy> = {}) {
  const candidate = deferred<ReplyTemplate | null>();
  const normal = deferred<string>();
  const settled = mock(() => {});
  let candidateSignal!: AbortSignal;
  let ordinarySignal!: AbortSignal;
  const policy: ReplyPreparationPolicy = { enabled: true, eligible: () => true,
    prepare: async req => { candidateSignal = req.signal; return candidate.promise; }, onSettled: settled, ...extra };
  const result = selectReplyPreparation({ policy, request, valid: value => 'text' in value && !!value.text,
    ordinary: async signal => { ordinarySignal = signal; return normal.promise; } });
  return { candidate, normal, result, settled, signals: () => ({ candidateSignal, ordinarySignal }) };
}

test('ready ordinary path wins immediately without waiting for classifier deadline', async () => {
  const f = fixture();
  f.normal.resolve('ready');
  expect(await f.result).toEqual({ kind: 'ordinary', value: 'ready' });
  expect(f.signals().candidateSignal.aborted).toBe(true);
  f.candidate.resolve({ text: 'too late' });
  await ticks();
  expect(f.settled).toHaveBeenCalledTimes(1);
  expect(f.settled.mock.calls[0][0]).toMatchObject({ outcome: 'candidate', aborted: true });
});
test('early candidate wins and aborts losing preparation without waiting for it', async () => {
  const f = fixture();
  f.candidate.resolve({ text: 'fast' });
  expect(await f.result).toEqual({ kind: 'template', value: { text: 'fast' } });
  expect(f.signals().ordinarySignal.aborted).toBe(true);
  f.normal.reject(new Error('late router error'));
  await ticks();
});
test.each([null, { text: '' }])('declined or invalid candidate keeps ordinary preparation', async value => {
  const f = fixture();
  f.candidate.resolve(value);
  await ticks();
  f.normal.resolve('fallback');
  expect(await f.result).toEqual({ kind: 'ordinary', value: 'fallback' });
});
test('factory rejection is observed once and does not break fallback', async () => {
  const f = fixture();
  f.candidate.reject(new Error('provider failed'));
  await ticks();
  f.normal.resolve('fallback');
  expect((await f.result).kind).toBe('ordinary');
  expect(f.settled).toHaveBeenCalledTimes(1);
  expect(f.settled.mock.calls[0][0]).toMatchObject({ outcome: 'error' });
});
test('candidate timeout declines; its actual late settlement remains observable', async () => {
  const f = fixture({ timeoutMs: 1 });
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(f.signals().candidateSignal.aborted).toBe(true);
  f.normal.resolve('fallback');
  expect((await f.result).kind).toBe('ordinary');
  f.candidate.resolve(null);
  await ticks();
  expect(f.settled).toHaveBeenCalledTimes(1);
});
test.each([false, undefined, Promise.resolve(true), 'true'])('only literal synchronous true starts the factory', async eligible => {
  const prepare = mock(async () => ({ text: 'unexpected' }));
  const f = fixture({ eligible: (() => eligible) as any, prepare });
  f.normal.resolve('fallback');
  expect((await f.result).kind).toBe('ordinary');
  expect(prepare).not.toHaveBeenCalled();
});
test('disconnect rejects promptly and aborts both paths; late factory is still observed', async () => {
  const controller = new AbortController();
  const factory = deferred<ReplyTemplate | null>();
  const ordinary = deferred<string>();
  const signals: AbortSignal[] = [];
  const settled = mock(() => {});
  const result = selectReplyPreparation({ signal: controller.signal, request, valid: () => true,
    policy: { enabled: true, eligible: () => true, prepare: req => { signals.push(req.signal); return factory.promise; }, onSettled: settled },
    ordinary: signal => { signals.push(signal); return ordinary.promise; } });
  await ticks();
  controller.abort(new Error('disconnect'));
  await expect(result).rejects.toThrow('disconnect');
  expect(signals.every(signal => signal.aborted)).toBe(true);
  factory.resolve({ text: 'late' });
  ordinary.reject(new Error('late'));
  await ticks();
  expect(settled).toHaveBeenCalledTimes(1);
});
test('already aborted request never starts either factory', async () => {
  const controller = new AbortController(); controller.abort();
  const prepare = mock(async () => null);
  const ordinary = mock(async () => 'never');
  await expect(selectReplyPreparation({ signal: controller.signal, request, valid: () => true,
    policy: { enabled: true, eligible: () => true, prepare }, ordinary })).rejects.toThrow();
  expect(prepare).not.toHaveBeenCalled();
  expect(ordinary).not.toHaveBeenCalled();
});
test('observer failures cannot delay or break a winning candidate', async () => {
  const f = fixture({ onSettled: async () => { throw new Error('sink'); } });
  f.candidate.resolve({ text: 'fast' });
  expect((await f.result).kind).toBe('template');
  f.normal.resolve('late');
});

test('simultaneous readiness prefers ordinary preparation', async () => {
  const f = fixture();
  await ticks();
  f.candidate.resolve({ text: 'same tick' });
  f.normal.resolve('same tick fallback');
  expect(await f.result).toEqual({ kind: 'ordinary', value: 'same tick fallback' });
});
test('a mistaken rejecting async gate declines without unhandled rejection', async () => {
  const prepare = mock(async () => ({ text: 'unsafe' }));
  const f = fixture({ eligible: (async () => { throw new Error('async gate'); }) as any, prepare });
  f.normal.resolve('fallback');
  expect((await f.result).kind).toBe('ordinary');
  expect(prepare).not.toHaveBeenCalled();
});
test('routing failure is observed even when the classifier never resolves', async () => {
  const f = fixture();
  f.normal.reject(new Error('routing failed'));
  await expect(f.result).rejects.toThrow('routing failed');
  expect(f.signals().candidateSignal.aborted).toBe(true);
  f.candidate.reject(new Error('late classifier failure'));
  await ticks();
  expect(f.settled).toHaveBeenCalledTimes(1);
});

test('candidate-first winner never starts ordinary preparation', async () => {
  const prepare = deferred<ReplyTemplate | null>();
  const ordinary = mock(async () => 'fallback');
  const result = selectReplyPreparation({ request, valid: () => true, ordinary,
    policy: { enabled: true, strategy: 'candidate-first', eligible: () => true, prepare: () => prepare.promise } });
  await ticks();
  expect(ordinary).not.toHaveBeenCalled();
  prepare.resolve({ text: 'selected' });
  expect(await result).toEqual({ kind: 'template', value: { text: 'selected' } });
  expect(ordinary).not.toHaveBeenCalled();
});

test.each(['decline', 'invalid', 'error'])('candidate-first %s starts fallback once', async outcome => {
  const ordinary = mock(async () => 'fallback');
  const result = await selectReplyPreparation({ request, ordinary, valid: value => 'text' in value && !!value.text,
    policy: { enabled: true, strategy: 'candidate-first', eligible: () => true, prepare: async () => {
      if (outcome === 'error') throw Error('provider failure');
      return outcome === 'decline' ? null : { text: '' };
    } } });
  expect(result).toEqual({ kind: 'ordinary', value: 'fallback' });
  expect(ordinary).toHaveBeenCalledTimes(1);
});

test('candidate-first deadline starts fallback without awaiting a late candidate', async () => {
  const candidate = deferred<ReplyTemplate | null>();
  const ordinary = mock(async () => 'fallback');
  let signal!: AbortSignal;
  const selection = mock(() => {});
  const result = await selectReplyPreparation({ request, ordinary, valid: () => true,
    policy: { enabled: true, strategy: 'candidate-first', timeoutMs: 5, eligible: () => true,
      prepare: req => { signal = req.signal; return candidate.promise; }, onSelection: selection } });
  expect(result.kind).toBe('ordinary');
  expect(signal.aborted).toBe(true);
  expect(ordinary).toHaveBeenCalledTimes(1);
  expect(selection.mock.calls[0][0].timedOut).toBe(true);
  candidate.resolve({ text: 'late' });
  await ticks();
  expect(selection).toHaveBeenCalledTimes(1);
});

test('candidate-first ineligible gate starts ordinary immediately and skips factory', async () => {
  const prepare = mock(async () => null);
  const ordinary = mock(async () => 'fallback');
  expect((await selectReplyPreparation({ request, ordinary, valid: () => true,
    policy: { enabled: true, strategy: 'candidate-first', eligible: () => false, prepare } })).kind).toBe('ordinary');
  expect(ordinary).toHaveBeenCalledTimes(1);
  expect(prepare).not.toHaveBeenCalled();
});

test('disconnect during candidate-first wait prevents fallback dispatch', async () => {
  const controller = new AbortController();
  const candidate = deferred<ReplyTemplate | null>();
  const ordinary = mock(async () => 'fallback');
  const result = selectReplyPreparation({ request, signal: controller.signal, ordinary, valid: () => true,
    policy: { enabled: true, strategy: 'candidate-first', eligible: () => true, prepare: () => candidate.promise } });
  await ticks();
  controller.abort(Error('disconnect'));
  await expect(result).rejects.toThrow('disconnect');
  candidate.resolve(null);
  await ticks();
  expect(ordinary).not.toHaveBeenCalled();
});
