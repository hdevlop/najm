import { describe, test, expect, mock } from 'bun:test';
import { importSemanticsViaJob } from '../../src/studio-ui/lib/importJob';
import { handleJsonSave } from '../../src/studio-ui/features/routing-semantics/utils/json-view-utils';
import { SemanticImportJobService } from '../../src/chatbotRag/SemanticImportJobService';

function job(status: string, extra: Record<string, unknown> = {}) {
  return { jobId: 'j1', status, total: 2, processed: 0, progressPercent: 0, inserted: 0, updated: 0, skipped: 0, failed: 0,
    currentPhase: 'embedding', currentFile: null, errors: [], files: [], failedBatches: [], startedAt: null, finishedAt: null, ...extra } as any;
}

function fakeClient(states: any[]) {
  const paths: string[] = [];
  let i = 0;
  return {
    paths,
    post: mock(async (path: string) => { paths.push(`POST ${path}`); return states[i++]; }),
    get: mock(async (path: string) => { paths.push(`GET ${path}`); return states[i++]; }),
  };
}

const noSleep = async () => {};

describe('studio imports go through import jobs, not one long request', () => {
  test('starts a job and polls it until it completes', async () => {
    const client = fakeClient([job('queued'), job('running'), job('completed', { inserted: 2 })]);
    const seen: string[] = [];
    const result = await importSemanticsViaJob(client, { orders_list: { en: ['a', 'b'] } }, { sleep: noSleep, onProgress: (j) => seen.push(j.status) });
    expect(client.paths).toEqual(['POST /semantics/import-jobs', 'GET /semantics/import-jobs/j1', 'GET /semantics/import-jobs/j1']);
    expect(seen).toEqual(['queued', 'running', 'completed']);
    expect(result.inserted).toBe(2);
  });

  test('a failed job throws with its error', async () => {
    const client = fakeClient([job('running'), job('failed', { errors: ['embedding provider unreachable'] })]);
    await expect(importSemanticsViaJob(client, {}, { sleep: noSleep })).rejects.toThrow('Import failed: embedding provider unreachable');
  });

  test('saving the JSON view sends additions to /semantics/import-jobs', async () => {
    const client = fakeClient([job('completed', { inserted: 1 })]);
    const result = await handleJsonSave(JSON.stringify({ orders_list: { en: ['show orders'] } }), [], client as any, async () => {});
    expect(client.paths).toEqual(['POST /semantics/import-jobs']);
    expect(result).toMatchObject({ inserted: 1, changed: true });
  });
});

describe('an import job from a JSON body stores no source file', () => {
  async function run(files: any[]) {
    const upserts: any[] = [];
    const repository = {
      findExistingSemantics: mock(async () => new Map()),
      upsertSemantic: mock(async (data: any) => { upserts.push(data); return 'inserted'; }),
      pruneDuplicateSemantics: mock(async () => 0),
    } as any;
    const embedding = { embedBatch: mock(async (texts: string[]) => texts.map(() => [0.1])) };
    const svc = new SemanticImportJobService(repository, embedding as any, {} as any);
    const { jobId } = svc.createImportJob(files);
    for (let i = 0; i < 100 && !['completed', 'failed'].includes(svc.getImportJob(jobId)!.status); i++) await new Promise((r) => setTimeout(r, 5));
    return { upserts, job: svc.getImportJob(jobId)! };
  }

  test('a pasted payload is stored like POST /semantics/import: no source file', async () => {
    const { upserts, job } = await run([{ name: 'import.json', sourceFile: null, content: { orders_list: { en: ['a'] } } }]);
    expect(job.status).toBe('completed');
    expect(upserts.map((u) => u.sourceFile)).toEqual([null]);
    expect(job.files[0].processed).toBe(1);
  });

  test('an uploaded file keeps its name as the source file', async () => {
    const { upserts } = await run([{ name: 'orders.json', content: { orders_list: { en: ['a'] } } }]);
    expect(upserts.map((u) => u.sourceFile)).toEqual(['orders.json']);
  });
});
