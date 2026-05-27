import { Service, Inject } from 'najm-core';
import { EmbeddingService } from '../embeddings';
import { ToolIndexRepository } from '../toolIndex';
import type { ImportJobState, ImportJobFileSummary } from './ChatbotRagDto';
import { initFileSummaries, markJobFailed, runBatches } from './runBatchImportJob';

@Service()
export class SemanticImportJobService {
  private importJobs = new Map<string, ImportJobState>();

  constructor(
    @Inject() private repository: ToolIndexRepository,
    @Inject() private embedding: EmbeddingService,
  ) {}

  createImportJob(files: Array<{ name: string; content: Record<string, Record<string, string[]>> }>): ImportJobState {
    const { nanoid: nanoidFn } = require('nanoid');
    const jobId = nanoidFn(12);
    const now = new Date().toISOString();

    const fileSummaries = initFileSummaries(files.map((f) => {
      let total = 0;
      for (const langs of Object.values(f.content)) {
        if (!langs || typeof langs !== 'object' || Array.isArray(langs)) continue;
        for (const phrases of Object.values(langs)) {
          if (!Array.isArray(phrases)) continue;
          total += phrases.length;
        }
      }
      return { name: f.name, total };
    }));

    const totalPhrases = fileSummaries.reduce((sum, f) => sum + f.total, 0);

    const job: ImportJobState = {
      jobId,
      status: 'queued',
      total: totalPhrases,
      processed: 0,
      progressPercent: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      currentPhase: 'parsing',
      currentFile: null,
      errors: [],
      files: fileSummaries,
      failedBatches: [],
      startedAt: now,
      finishedAt: null,
    };

    this.importJobs.set(jobId, job);

    this.runImportJob(jobId, files).catch((err) => {
      const j = this.importJobs.get(jobId);
      if (j) markJobFailed(j, err);
    });

    return job;
  }

  getImportJob(jobId: string): ImportJobState | null {
    return this.importJobs.get(jobId) ?? null;
  }

  private async runImportJob(jobId: string, files: Array<{ name: string; content: Record<string, Record<string, string[]>> }>): Promise<void> {
    const job = this.importJobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.currentPhase = 'parsing';

    const BATCH_SIZE = 100;
    const allEntries: Array<{ toolName: string; phrase: string; lang: string; sourceFile: string }> = [];

    for (const file of files) {
      job.currentFile = file.name;

      for (const [toolName, langs] of Object.entries(file.content)) {
        if (!langs || typeof langs !== 'object' || Array.isArray(langs)) continue;
        for (const [lang, phrases] of Object.entries(langs)) {
          if (!Array.isArray(phrases)) continue;
          for (const phrase of phrases) {
            allEntries.push({ toolName: toolName.trim(), phrase: String(phrase).trim(), lang: (lang.trim() || 'und'), sourceFile: file.name });
          }
        }
      }
    }

    const seen = new Set<string>();
    const deduped: typeof allEntries = [];
    const dedupedAway: typeof allEntries = [];

    for (const entry of allEntries) {
      if (!entry.phrase || !entry.toolName) continue;
      const key = `${entry.toolName}\u0000${entry.phrase}\u0000${entry.lang}`;
      if (seen.has(key)) {
        dedupedAway.push(entry);
        continue;
      }
      seen.add(key);
      deduped.push(entry);
    }

    for (const entry of dedupedAway) {
      const fileSummary = job.files.find((f) => f.fileName === entry.sourceFile);
      if (fileSummary) {
        fileSummary.processed++;
        fileSummary.skipped++;
        fileSummary.progressPercent = Math.round((fileSummary.processed / fileSummary.total) * 100);
      }
    }

    job.total = deduped.length;
    job.currentPhase = 'checking';

    const existingMap = await this.repository.findExistingSemantics(
      deduped.map((e) => ({ toolName: e.toolName, phrase: e.phrase, lang: e.lang })),
    );

    const toEmbed: Array<typeof deduped[number]> = [];
    const alreadySkipped: Array<typeof deduped[number]> = [];

    for (const entry of deduped) {
      const key = `${entry.toolName}\u0000${entry.phrase}\u0000${entry.lang}`;
      const existing = existingMap.get(key);
      if (existing?.hasEmbedding) {
        alreadySkipped.push(entry);
      } else {
        toEmbed.push(entry);
      }
    }

    for (const entry of alreadySkipped) {
      job.processed++;
      job.skipped++;
      job.progressPercent = Math.round((job.processed / job.total) * 100);
      const fileSummary = job.files.find((f) => f.fileName === entry.sourceFile);
      if (fileSummary) {
        fileSummary.processed++;
        fileSummary.skipped++;
        fileSummary.progressPercent = Math.round((fileSummary.processed / fileSummary.total) * 100);
      }
    }

    job.currentPhase = 'embedding';

    await runBatches(
      toEmbed,
      BATCH_SIZE,
      async (batch, batchIndex, batchStart) => {
        const phrases = batch.map((e) => e.phrase);
        const embeddings = await this.embedding.embedBatch(phrases);

        job.currentPhase = 'saving';

        for (let i = 0; i < batch.length; i++) {
          const entry = batch[i];
          try {
            const status = await this.repository.upsertSemantic({
              toolName: entry.toolName,
              phrase: entry.phrase,
              lang: entry.lang,
              source: 'import',
              sourceFile: entry.sourceFile,
              embedding: embeddings[i] ?? null,
              skipIfHasEmbedding: false,
            });

            job.processed++;
            if (status === 'inserted') job.inserted++;
            else if (status === 'updated') job.updated++;
            else job.skipped++;

            const fileSummary = job.files.find((f) => f.fileName === entry.sourceFile);
            if (fileSummary) {
              fileSummary.processed++;
              if (status === 'inserted') fileSummary.inserted++;
              else if (status === 'updated') fileSummary.updated++;
              else fileSummary.skipped++;
              fileSummary.progressPercent = Math.round((fileSummary.processed / fileSummary.total) * 100);
            }
          } catch (err) {
            job.processed++;
            job.failed++;
            const msg = err instanceof Error ? err.message : String(err);
            job.errors.push(msg);
            const fileSummary = job.files.find((f) => f.fileName === entry.sourceFile);
            if (fileSummary) {
              fileSummary.processed++;
              fileSummary.failed++;
              fileSummary.errors.push(msg);
              fileSummary.progressPercent = Math.round((fileSummary.processed / fileSummary.total) * 100);
            }
          }
        }

        job.progressPercent = Math.round((job.processed / job.total) * 100);
        job.currentPhase = batchStart + BATCH_SIZE < toEmbed.length ? 'embedding' : 'saving';
      },
      (batch, batchIndex, batchStart, error) => {
        job.failedBatches.push({
          batchIndex,
          offset: batchStart,
          count: batch.length,
          error,
        });
        for (const entry of batch) {
          job.processed++;
          job.failed++;
          const fileSummary = job.files.find((f) => f.fileName === entry.sourceFile);
          if (fileSummary) {
            fileSummary.processed++;
            fileSummary.failed++;
            fileSummary.errors.push(error);
            fileSummary.progressPercent = Math.round((fileSummary.processed / fileSummary.total) * 100);
          }
        }
        job.progressPercent = Math.round((job.processed / job.total) * 100);
        job.errors.push(`Batch ${batchIndex} failed: ${error}`);
      },
    );

    job.currentPhase = 'completed';
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
    job.currentFile = null;
    job.progressPercent = 100;
  }
}
