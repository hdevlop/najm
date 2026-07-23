import type { ImportJobState, ImportJobFileSummary } from './ChatbotRagDto';

export function initFileSummaries(files: Array<{ name: string; total: number }>): ImportJobFileSummary[] {
  return files.map((f) => ({
    fileName: f.name,
    total: f.total,
    processed: 0,
    progressPercent: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }));
}

export function markJobFailed(job: ImportJobState, err: unknown): void {
  job.status = 'failed';
  job.errors.push(err instanceof Error ? err.message : String(err));
  job.finishedAt = new Date().toISOString();
}

export async function runBatches<T>(
  items: T[],
  batchSize: number,
  processBatch: (batch: T[], batchIndex: number, offset: number) => Promise<void>,
  onBatchError: (batch: T[], batchIndex: number, offset: number, error: string) => void,
): Promise<void> {
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    const batchIndex = Math.floor(offset / batchSize);
    try {
      await processBatch(batch, batchIndex, offset);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onBatchError(batch, batchIndex, offset, message);
    }
  }
}
