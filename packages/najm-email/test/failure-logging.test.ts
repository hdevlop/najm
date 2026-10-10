import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { LoggerService } from 'najm-core';
import { BaseProvider, EmailService } from '../src';
import type { BulkSendResult, EmailConfig, EmailMessage, EmailProvider, SendResult } from '../src';

const FAILURE = 'Email delivery failed';

// Every place a recipient address can hide. None may reach the log.
const SENTINELS = [
  'sentinel-to@leak.test',
  'sentinel-cc@leak.test',
  'sentinel-bcc@leak.test',
  'SENTINEL-SUBJECT',
  'SENTINEL-CONTENT',
  'sentinel-response@leak.test',
  'sentinel-error@leak.test',
  'sentinel-prop@leak.test',
];

const message: EmailMessage = {
  to: { email: 'sentinel-to@leak.test', name: 'To' },
  cc: 'sentinel-cc@leak.test',
  bcc: ['sentinel-bcc@leak.test'],
  subject: 'SENTINEL-SUBJECT',
  html: '<p>SENTINEL-CONTENT</p>',
  text: 'SENTINEL-CONTENT',
};

const failedResult = (): SendResult => ({
  success: false,
  error: 'rejected sentinel-error@leak.test',
  response: { echo: 'sentinel-response@leak.test' },
});

const thrownError = () => Object.assign(new Error('refused sentinel-error@leak.test'), {
  recipient: 'sentinel-prop@leak.test',
  response: { echo: 'sentinel-response@leak.test' },
});

// ---------------------------------------------------------------------------
// Harness: the real EmailService and LoggerService, with console captured.
// ---------------------------------------------------------------------------

let output: string[] = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  output = [];
  console.log = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
  console.error = (...args: unknown[]) => { output.push(args.map(String).join(' ')); };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

function service(provider: EmailProvider, config: Partial<EmailConfig> = {}, format: 'json' | 'pretty' = 'json') {
  const instance = new EmailService() as any;
  instance.config = { provider: { provider: 'memory' }, retry: { attempts: 2, delay: 0 }, ...config };
  instance.log = new LoggerService({ level: 'DEBUG', format, colors: false, includeTimestamp: false }, false);
  instance.provider = provider;
  instance.initialized = true;
  return instance as EmailService;
}

const failureLogs = () => output.filter((line) => line.includes(FAILURE));
const failureEntries = () => failureLogs().map((line) => JSON.parse(line));

/** A provider whose single sends follow `outcomes` in order. */
function singleProvider(...outcomes: Array<'ok' | 'fail' | 'throw'>): EmailProvider & { calls: number } {
  return {
    name: 'mock',
    calls: 0,
    async initialize() {},
    async send() {
      const outcome = outcomes[Math.min(this.calls++, outcomes.length - 1)];
      if (outcome === 'throw') throw thrownError();
      return outcome === 'ok' ? { success: true, messageId: 'm' } : failedResult();
    },
  };
}

/** A provider with its own batch endpoint. */
function batchProvider(outcome: BulkSendResult | 'throw'): EmailProvider {
  return {
    name: 'batch',
    async initialize() {},
    async send() { return { success: true }; },
    async sendBulk(messages) {
      if (outcome === 'throw') throw thrownError();
      expect(messages).toHaveLength(outcome.total);
      return outcome;
    },
  };
}

/** Inherits BaseProvider.sendBulk; the second message of a batch fails. */
class InheritingProvider extends BaseProvider {
  readonly name = 'inheriting';
  private count = 0;
  constructor(private readonly failEvery = 2) { super(); }
  async initialize() {}
  async send(): Promise<SendResult> {
    this.count++;
    return this.count % this.failEvery === 0 ? failedResult() : { success: true, messageId: `m${this.count}` };
  }
}

// ---------------------------------------------------------------------------

describe('single send failure log', () => {
  test('a failed result after retries logs exactly once with safe fields; the result is returned unchanged', async () => {
    const provider = singleProvider('fail');
    const result = await service(provider).send(message);

    expect(result).toEqual(failedResult());
    expect(failureEntries()).toEqual([
      expect.objectContaining({ level: 'ERROR', message: FAILURE, context: { provider: 'mock', operation: 'send' } }),
    ]);
  });

  test('a throw on every retry logs once and rethrows the same error', async () => {
    const provider = singleProvider('throw');
    const emails = service(provider);

    await expect(emails.send(message)).rejects.toThrow('refused sentinel-error@leak.test');
    expect(provider.calls).toBe(2);
    expect(failureLogs()).toHaveLength(1);
  });

  test('a send that succeeds on retry, or at once, logs no failure', async () => {
    await service(singleProvider('throw', 'ok')).send(message);
    await service(singleProvider('ok')).sendText('a@b.c', 's', 't');
    expect(failureLogs()).toEqual([]);
  });

  test('the email:failed event is still emitted', async () => {
    const emails = service(singleProvider('fail'));
    const events: unknown[] = [];
    emails.on('email:failed', (payload) => { events.push(payload); });

    await emails.send(message);
    expect(events).toHaveLength(1);
  });
});

describe('bulk send failure log', () => {
  const ok = { success: true, messageId: 'x' };

  test('native batch: partial failure logs one aggregate entry with the failed count', async () => {
    const outcome = { total: 3, sent: 1, failed: 2, results: [ok, failedResult(), failedResult()] };
    const result = await service(batchProvider(outcome)).sendBulk([message, message, message]);

    expect(result).toBe(outcome);
    expect(failureEntries().map((entry) => entry.context)).toEqual([
      { provider: 'batch', operation: 'sendBulk', failed: 2 },
    ]);
  });

  test('native batch: complete failure logs once', async () => {
    const outcome = { total: 2, sent: 0, failed: 2, results: [failedResult(), failedResult()] };
    await service(batchProvider(outcome)).sendBulk([message, message]);

    expect(failureEntries().map((entry) => entry.context.failed)).toEqual([2]);
  });

  test('native batch: a thrown batch counts every submitted message and rethrows', async () => {
    await expect(service(batchProvider('throw')).sendBulk([message, message, message]))
      .rejects.toThrow('refused sentinel-error@leak.test');

    expect(failureEntries().map((entry) => entry.context)).toEqual([
      { provider: 'batch', operation: 'sendBulk', failed: 3 },
    ]);
  });

  test('inherited BaseProvider.sendBulk logs one aggregate entry', async () => {
    const result = await service(new InheritingProvider()).sendBulk([message, message, message, message]);

    expect(result.failed).toBe(2);
    expect(failureEntries().map((entry) => entry.context)).toEqual([
      { provider: 'inheriting', operation: 'sendBulk', failed: 2 },
    ]);
  });

  test('sequential fallback logs one aggregate entry and no per-message entries', async () => {
    const provider = singleProvider('fail', 'ok', 'throw');
    const emails = service(provider, { retry: { attempts: 1, delay: 0 } });
    const result = await emails.sendBulk([message, message, message]);

    expect(result).toMatchObject({ total: 3, sent: 1, failed: 2 });
    expect(result.results[2]).toEqual({ success: false, error: 'refused sentinel-error@leak.test' });
    expect(failureEntries().map((entry) => entry.context)).toEqual([
      { provider: 'mock', operation: 'sendBulk', failed: 2 },
    ]);
  });

  test('successful and empty batches log nothing', async () => {
    await service(batchProvider({ total: 1, sent: 1, failed: 0, results: [ok] })).sendBulk([message]);
    await service(new InheritingProvider(Number.MAX_SAFE_INTEGER)).sendBulk([message, message]);
    await service(singleProvider('ok')).sendBulk([message]);
    await service(singleProvider('fail')).sendBulk([]);
    await service(batchProvider({ total: 0, sent: 0, failed: 0, results: [] })).sendBulk([]);

    expect(failureLogs()).toEqual([]);
  });
});

describe('logFailures: false', () => {
  test('suppresses the built-in log in every single and bulk path', async () => {
    const off = { logFailures: false };

    await service(singleProvider('fail'), off).send(message);
    await expect(service(singleProvider('throw'), off).send(message)).rejects.toThrow();
    await service(batchProvider({ total: 1, sent: 0, failed: 1, results: [failedResult()] }), off).sendBulk([message]);
    await expect(service(batchProvider('throw'), off).sendBulk([message])).rejects.toThrow();
    await service(new InheritingProvider(1), off).sendBulk([message]);
    await service(singleProvider('fail'), off).sendBulk([message, message]);

    expect(failureLogs()).toEqual([]);
  });
});

describe('failure log privacy', () => {
  for (const format of ['json', 'pretty'] as const) {
    test(`${format}: no recipient, subject, content, response or error text reaches the log`, async () => {
      await service(singleProvider('fail'), {}, format).send(message);
      await expect(service(singleProvider('throw'), {}, format).send(message)).rejects.toThrow();
      await service(batchProvider({ total: 1, sent: 0, failed: 1, results: [failedResult()] }), {}, format).sendBulk([message]);
      await expect(service(batchProvider('throw'), {}, format).sendBulk([message, message])).rejects.toThrow();
      await service(new InheritingProvider(1), {}, format).sendBulk([message]);
      await service(singleProvider('throw'), { retry: { attempts: 1, delay: 0 } }, format).sendBulk([message]);

      const everything = output.join('\n');
      for (const sentinel of SENTINELS) expect(everything).not.toContain(sentinel);

      // The safe fields stay observable. Pretty output indents its context JSON.
      const field = (key: string, value: unknown) =>
        `"${key}":${format === 'json' ? '' : ' '}${JSON.stringify(value)}`;
      expect(failureLogs()).toHaveLength(6);
      expect(everything).toContain(field('operation', 'send'));
      expect(everything).toContain(field('failed', 2));
      expect(everything).toContain(field('provider', 'inheriting'));
    });
  }
});
