import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService } from '../src/toolRouter';

function makeRouter(recordMiss: (data: any) => Promise<void>) {
  const config = { toolRouting: { enabled: true, similarityThreshold: 0.45, fallbackOnNoMatch: 'none' } } as any;
  const repository = {
    searchSemantics: mock(async () => [{ toolName: 'orders_list', similarity: 0.2 }]),
    searchEmbeddings: mock(async () => []),
  } as any;
  const unmatched = { recordMiss: mock(recordMiss) } as any;
  const router = new ToolRouterService(
    config,
    { tools: [{ name: 'orders_list', description: 'List orders' }] } as any,
    {
      embed: async () => new Array(768).fill(0.1),
      embedQueries: async (texts: string[]) => texts.map(() => new Array(768).fill(0.1)),
    } as any,
    repository,
    { error() {}, warn() {} } as any,
    { getRoutingConfig: async () => config.toolRouting } as any,
    unmatched,
  );
  return { router, unmatched };
}

describe('R5: the unmatched inbox records the latest message', () => {
  test('a second-turn miss records only the second message', async () => {
    const { router, unmatched } = makeRouter(async () => {});
    const routingText = 'show my orders\n---\nwhat about the weather';

    const result = await router.findRelevantTools(routingText, { latestUserText: 'What about the weather' });
    await router.settled();

    expect(result.status).toBe('fallback_none');
    expect(unmatched.recordMiss).toHaveBeenCalledTimes(1);
    const recorded = unmatched.recordMiss.mock.calls[0][0];
    expect(recorded.query).toBe('What about the weather');
    expect(recorded.normalized).toBe('what about the weather');
    expect(recorded.query).not.toContain('---');
  });

  test('without the latest message, the routing text is recorded as before', async () => {
    const { router, unmatched } = makeRouter(async () => {});
    await router.findRelevantTools('what about the weather');
    await router.settled();
    expect(unmatched.recordMiss.mock.calls[0][0].query).toBe('what about the weather');
  });
});

describe('T3: recording a miss does not delay the result', () => {
  test('the router answers while the miss write is still pending', async () => {
    let release!: () => void;
    const { router, unmatched } = makeRouter(() => new Promise<void>((resolve) => { release = resolve; }));

    const result = await Promise.race([
      router.findRelevantTools('what about the weather'),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 200)),
    ]);

    expect(result).not.toBe('blocked');
    expect(unmatched.recordMiss).toHaveBeenCalledTimes(1);
    release();
    await router.settled();
  });

  test('a failing miss write is logged, not thrown', async () => {
    const { router } = makeRouter(async () => { throw new Error('db down'); });
    const result = await router.findRelevantTools('what about the weather');
    await router.settled();
    expect(result.status).toBe('fallback_none');
  });
});
