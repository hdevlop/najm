import type { ImportJobState } from '@/features/routing-semantics/types';

interface JobClient {
  post<T>(path: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
}

export interface SemanticsImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

const POLL_MS = 1000;

/**
 * Imports phrases through `/semantics/import-jobs` and waits for the job.
 *
 * `POST /semantics/import` embeds the whole payload inside one request: a
 * 228-phrase file on a CPU embedder ran past five minutes, and fetch stops
 * waiting for response headers after 300 s. A job answers at once and is
 * polled, so an import of any size finishes.
 */
export async function importSemanticsViaJob(
  client: JobClient,
  payload: unknown,
  options: { pollMs?: number; onProgress?: (job: ImportJobState) => void; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ImportJobState> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let job = await client.post<ImportJobState>('/semantics/import-jobs', payload);
  options.onProgress?.(job);
  while (job.status === 'queued' || job.status === 'running') {
    await sleep(options.pollMs ?? POLL_MS);
    job = await client.get<ImportJobState>(`/semantics/import-jobs/${job.jobId}`);
    options.onProgress?.(job);
  }
  if (job.status === 'failed') {
    throw new Error(job.errors?.[0] ? `Import failed: ${job.errors[0]}` : 'Import failed');
  }
  return job;
}

export function summarizeImportJob(job: ImportJobState): SemanticsImportSummary {
  return { inserted: job.inserted, updated: job.updated, skipped: job.skipped, failed: job.failed };
}
