import { describe, test, expect, mock } from 'bun:test';
import { ToolRouterService, RoutingPreviewService } from '../src/toolRouter';
import type { RoutingRerankConfig } from '../src/config';

const VECTOR = new Array(768).fill(0.1);

// Router order: student (0.90) > report (0.80) > section (0.75) > kpis (0.70);
// near miss: teacher (0.62); far: weather (0.30). Threshold 0.68.
const SCORES = [
  { toolName: 'grades_by_student', similarity: 0.9 },
  { toolName: 'grades_report', similarity: 0.8 },
  { toolName: 'grades_by_section', similarity: 0.75 },
  { toolName: 'kpis', similarity: 0.7 },
  { toolName: 'grades_by_teacher', similarity: 0.62 },
  { toolName: 'weather', similarity: 0.3 },
];
const TOOLS = SCORES.map((score) => ({
  name: score.toolName,
  description: `Read ${score.toolName}`,
  annotations: { readOnlyHint: true },
}));

function build(rerankTools?: RoutingRerankConfig, scores = SCORES, dependencies: Record<string, string[]> = {}) {
  const config = {
    toolRouting: { enabled: true, similarityThreshold: 0.68, fallbackOnNoMatch: 'none', dependencies },
    rerankTools,
  } as any;
  const embedding = { embed: mock(async () => VECTOR) } as any;
  const repository = {
    searchSemantics: async () => scores,
    searchEmbeddings: async () => [],
    scoreEmbeddingsForTools: async () => [],
  } as any;
  const unmatched = { recordMiss: mock(async () => {}) } as any;
  const registry = { tools: TOOLS } as any;
  const provider = { getRoutingConfig: async () => config.toolRouting } as any;
  const log = { error() {}, warn() {} } as any;
  return {
    router: new ToolRouterService(config, registry, embedding, repository, log, provider, unmatched),
    preview: new RoutingPreviewService(config, registry, embedding, repository, log, provider),
    unmatched,
  };
}

const names = (result: { tools: Array<{ name: string }> }) => result.tools.map((tool) => tool.name);
const ROUTER_ORDER = ['grades_by_student', 'grades_report', 'grades_by_section', 'kpis'];

describe('rerankTools: a second judge after embedding search', () => {
  test('without the hook routing is unchanged', async () => {
    const result = await build().router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(ROUTER_ORDER);
    expect(result.rerank).toBeUndefined();
  });

  test('the hook sees the message and the candidates with descriptions, best first', async () => {
    const rerank = mock(async () => null);
    await build({ rerank }).router.findRelevantTools('notes de la classe');
    expect(rerank).toHaveBeenCalledTimes(1);
    const request = (rerank.mock.calls[0] as any)[0];
    expect(request.query).toBe('notes de la classe');
    expect(request.candidates.map((c: any) => c.toolName)).toEqual(ROUTER_ORDER);
    expect(request.candidates[0]).toMatchObject({ description: 'Read grades_by_student', similarity: 0.9 });
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  test('a pick at selectAt leads, followed by keepRouterTools of the router matches', async () => {
    const { router } = build({ rerank: async () => ({ toolName: 'grades_by_section', confidence: 0.9 }), keepRouterTools: 2 });
    const result = await router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(['grades_by_section', 'grades_by_student', 'grades_report']);
    expect(result.rerank).toEqual({ pick: { toolName: 'grades_by_section', confidence: 0.9 }, applied: 'selected', candidates: 4 });
  });

  test('a selected pick brings its dependencies', async () => {
    const { router } = build({ rerank: async () => ({ toolName: 'kpis', confidence: 0.95 }), keepRouterTools: 0 },
      SCORES, { kpis: ['grades_report'] });
    expect(names(await router.findRelevantTools('kpis'))).toEqual(['kpis', 'grades_report']);
  });

  test('a pick between promoteAt and selectAt moves to the top, nothing dropped', async () => {
    const { router } = build({ rerank: async () => ({ toolName: 'grades_by_section', confidence: 0.75 }) });
    const result = await router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(['grades_by_section', 'grades_by_student', 'grades_report', 'kpis']);
    expect(result.rerank?.applied).toBe('promoted');
  });

  test('a pick below promoteAt keeps the router order', async () => {
    const { router } = build({ rerank: async () => ({ toolName: 'grades_by_section', confidence: 0.5 }) });
    const result = await router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(ROUTER_ORDER);
    expect(result.rerank?.applied).toBe('unchanged');
  });

  test('"none" keeps the router order', async () => {
    const { router } = build({ rerank: async () => ({ toolName: null, confidence: 0.99 }) });
    expect(names(await router.findRelevantTools('notes de la classe'))).toEqual(ROUTER_ORDER);
  });

  test.each([
    ['a tool that is not a candidate', async () => ({ toolName: 'weather', confidence: 0.99 })],
    ['a confidence above 1', async () => ({ toolName: 'kpis', confidence: 1.5 })],
    ['a missing confidence', async () => ({ toolName: 'kpis' }) as any],
    ['a throw', async () => { throw new Error('provider down'); }],
  ])('%s keeps the router order', async (_label, rerank) => {
    const result = await build({ rerank }).router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(ROUTER_ORDER);
    expect(result.rerank).toEqual({ pick: null, applied: 'unchanged', candidates: 4 });
  });

  test('a reranker that does not answer in time keeps the router order and is aborted', async () => {
    let aborted = false;
    const { router } = build({
      timeoutMs: 50,
      rerank: ({ signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => { aborted = true; resolve({ toolName: 'kpis', confidence: 0.99 }); });
      }),
    });
    const started = Date.now();
    const result = await router.findRelevantTools('notes de la classe');
    expect(names(result)).toEqual(ROUTER_ORDER);
    expect(aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('near misses are shown only down to minSimilarity', async () => {
    const rerank = mock(async () => null);
    await build({ rerank, minSimilarity: 0.6 }).router.findRelevantTools('notes du prof');
    const request = (rerank.mock.calls[0] as any)[0];
    expect(request.candidates.map((c: any) => c.toolName)).toEqual([...ROUTER_ORDER, 'grades_by_teacher']);
  });

  test('a near miss is rescued at selectAt', async () => {
    const onlyNear = SCORES.filter((score) => score.similarity < 0.68);
    const { router, unmatched } = build({ rerank: async () => ({ toolName: 'grades_by_teacher', confidence: 0.9 }), minSimilarity: 0.6 }, onlyNear);
    const result = await router.findRelevantTools('notes du prof');
    await router.settled();
    expect(result.status).toBe('routed');
    expect(names(result)).toEqual(['grades_by_teacher']);
    expect(unmatched.recordMiss).not.toHaveBeenCalled();
  });

  test('a near miss is not promoted below selectAt', async () => {
    const { router } = build({ rerank: async () => ({ toolName: 'grades_by_teacher', confidence: 0.8 }), minSimilarity: 0.6 });
    expect(names(await router.findRelevantTools('notes du prof'))).toEqual(ROUTER_ORDER);
  });

  test('a message with no candidate above minSimilarity never calls the hook', async () => {
    const rerank = mock(async () => ({ toolName: 'weather', confidence: 0.99 }));
    const { router, unmatched } = build({ rerank, minSimilarity: 0.6 }, [{ toolName: 'weather', similarity: 0.3 }]);
    const result = await router.findRelevantTools('salam');
    await router.settled();
    expect(result.status).toBe('fallback_none');
    expect(rerank).not.toHaveBeenCalled();
    expect(unmatched.recordMiss).toHaveBeenCalledTimes(1);
  });

  test('a repeated message reuses the answer; a failure is not cached', async () => {
    const answers = [Promise.reject(new Error('down')), Promise.resolve({ toolName: 'kpis', confidence: 0.9 })];
    answers[0].catch(() => {});
    const rerank = mock(() => answers.shift() ?? Promise.resolve({ toolName: 'kpis', confidence: 0.9 }));
    const { router } = build({ rerank });
    await router.findRelevantTools('kpis please');
    await router.findRelevantTools('kpis please');
    await router.findRelevantTools('kpis please');
    expect(rerank).toHaveBeenCalledTimes(2);
  });

  test('the preview routes and reports the pick the same way', async () => {
    const { preview } = build({ rerank: async () => ({ toolName: 'grades_by_teacher', confidence: 0.9 }), minSimilarity: 0.6 });
    const result = await preview.previewRouting('notes du prof');
    expect(result.finalTools[0]).toBe('grades_by_teacher');
    expect(result.rerank).toEqual({ pick: { toolName: 'grades_by_teacher', confidence: 0.9 }, applied: 'selected', candidates: 5 });
    expect(result.finalToolScores?.[0]).toMatchObject({ toolName: 'grades_by_teacher', matchLevel: 'primary' });
  });
});
