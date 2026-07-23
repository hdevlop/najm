import { Service, Inject } from 'najm-core';
import { RoutingPreviewService } from '../toolRouter/RoutingPreviewService';
import { RoutingTestsRepository } from './RoutingTestsRepository';
import type {
  CreateRoutingTestDto,
  UpdateRoutingTestDto,
  ImportRoutingTestsDto,
  PaginatedRoutingTestsResponse,
  RoutingTestRow,
  RoutingTestScore,
  RoutingTestStatus,
} from './RoutingTestsDto';
import type { ImportJobState } from '../chatbotRag/ChatbotRagDto';
import { initFileSummaries, markJobFailed, runBatches } from '../chatbotRag/runBatchImportJob';


interface ComputedResult {
  status: RoutingTestStatus;
  confidence: number;
  actualTools: string[];
  missingTools: string[];
  scores: RoutingTestScore[];
}

interface RoutingTestFile {
  name: string;
  tests: Array<{ name: string; query: string; lang?: string; expectedTools: string[] }>;
}

@Service()
export class RoutingTestsService {
  @Inject() private repository!: RoutingTestsRepository;
  @Inject() private preview!: RoutingPreviewService;

  private importJobs = new Map<string, ImportJobState>();

  async list(): Promise<RoutingTestRow[]> {
    return this.repository.list();
  }

  async listPaginated(opts: { limit?: number; offset?: number; search?: string; status?: string }): Promise<PaginatedRoutingTestsResponse> {
    const rawLimit = opts.limit ?? 100;
    const rawOffset = opts.offset ?? 0;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 250) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
    const { items, total } = await this.repository.listPaginated({ limit, offset, search: opts.search, status: opts.status });
    return { items, total, limit, offset };
  }

  async getById(id: string): Promise<RoutingTestRow | null> {
    return this.repository.findById(id);
  }

  async create(data: CreateRoutingTestDto): Promise<RoutingTestRow> {
    return this.repository.create({
      name: data.name.trim(),
      query: data.query.trim(),
      lang: data.lang?.trim() || 'und',
      expectedTools: [...new Set(data.expectedTools.map((t) => t.trim()).filter(Boolean))],
    });
  }

  async update(id: string, data: UpdateRoutingTestDto): Promise<RoutingTestRow | null> {
    const patch: Partial<{ name: string; query: string; lang: string; expectedTools: string[] }> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.query !== undefined) patch.query = data.query.trim();
    if (data.lang !== undefined) patch.lang = data.lang.trim() || 'und';
    if (data.expectedTools !== undefined) {
      patch.expectedTools = [...new Set(data.expectedTools.map((t) => t.trim()).filter(Boolean))];
    }
    return this.repository.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    await this.repository.deleteById(id);
  }

  async deleteMany(ids: string[]): Promise<{ deleted: number }> {
    const cleanIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const deleted = await this.repository.deleteByIds(cleanIds);
    return { deleted };
  }

  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    return { deleted };
  }

  async runOne(id: string): Promise<RoutingTestRow | null> {
    const test = await this.repository.findById(id);
    if (!test) return null;
    const result = await this.executeTest(test.query, test.expectedTools);
    await this.repository.saveResult(id, result);
    return this.repository.findById(id);
  }

  async runAll(): Promise<RoutingTestRow[]> {
    const tests = await this.repository.list();
    for (const test of tests) {
      try {
        const result = await this.executeTest(test.query, test.expectedTools);
        await this.repository.saveResult(test.id, result);
      } catch {
        await this.repository.saveResult(test.id, {
          status: 'fail',
          confidence: 0,
          actualTools: ['error'],
          missingTools: test.expectedTools,
          scores: [],
        });
      }
    }
    return this.repository.list();
  }

  async import(data: ImportRoutingTestsDto): Promise<{ imported: number }> {
    if (data.mode === 'replace') {
      await this.repository.deleteAll();
    }
    let imported = 0;
    for (const t of data.tests) {
      await this.repository.create({
        name: t.name.trim(),
        query: t.query.trim(),
        lang: t.lang?.trim() || 'und',
        expectedTools: [...new Set(t.expectedTools.map((tool) => tool.trim()).filter(Boolean))],
      });
      imported += 1;
    }
    return { imported };
  }

  async export(): Promise<{ format: string; version: number; exportedCount: number; tests: Array<{ id: string; name: string; query: string; lang: string; expectedTools: string[] }> }> {
    const rows = await this.repository.list();
    const tests = rows.map((r) => ({ id: r.id, name: r.name, query: r.query, lang: r.lang, expectedTools: r.expectedTools }));
    return {
      format: 'najm-rag-routing-tests',
      version: 2,
      exportedCount: tests.length,
      tests,
    };
  }

  parseRoutingTestsFile(name: string, raw: string): RoutingTestFile {
    const parsed = JSON.parse(raw) as unknown;
    let tests: Array<{ name: unknown; query: unknown; expectedTools: unknown }>;
    if (parsed && typeof parsed === 'object' && 'tests' in parsed && Array.isArray((parsed as any).tests)) {
      tests = (parsed as any).tests;
    } else if (Array.isArray(parsed)) {
      tests = parsed as any[];
    } else {
      throw new Error(`Invalid routing tests JSON in file "${name}". Expected { "tests": [...] } or an array.`);
    }
    const valid: Array<{ name: string; query: string; lang?: string; expectedTools: string[] }> = [];
    for (const t of tests) {
      if (!t || typeof t !== 'object') continue;
      const tName = typeof t.name === 'string' ? t.name.trim() : '';
      const tQuery = typeof t.query === 'string' ? t.query.trim() : '';
      const tLang = typeof (t as any).lang === 'string' ? (t as any).lang.trim() : '';
      const tExpected = Array.isArray(t.expectedTools)
        ? [...new Set((t.expectedTools as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))]
        : [];
      if (!tName || !tQuery || tExpected.length === 0) continue;
      valid.push({ name: tName, query: tQuery, lang: tLang || undefined, expectedTools: tExpected });
    }
    return { name, tests: valid };
  }

  async createImportJob(files: RoutingTestFile[]): Promise<ImportJobState> {
    const { nanoid: nanoidFn } = await import('nanoid');
    const jobId = nanoidFn(12);
    const now = new Date().toISOString();

    const fileSummaries = initFileSummaries(files.map((f) => ({ name: f.name, total: f.tests.length })));
    const total = fileSummaries.reduce((sum, f) => sum + f.total, 0);

    const job: ImportJobState = {
      jobId,
      status: 'queued',
      total,
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
    setTimeout(() => {
      this.runImportJob(jobId, files).catch((err) => {
        const j = this.importJobs.get(jobId);
        if (j) markJobFailed(j, err);
      });
    }, 0);
    return JSON.parse(JSON.stringify(job)) as ImportJobState;
  }

  getImportJob(jobId: string): ImportJobState | null {
    return this.importJobs.get(jobId) ?? null;
  }

  private async runImportJob(jobId: string, files: RoutingTestFile[]): Promise<void> {
    const job = this.importJobs.get(jobId);
    if (!job) return;
    job.status = 'running';
    job.currentPhase = 'saving';

    const BATCH_SIZE = 100;

    for (const file of files) {
      job.currentFile = file.name;
      const fileSummary = job.files.find((f) => f.fileName === file.name);

      await runBatches(
        file.tests,
        BATCH_SIZE,
        async (batch) => {
          const inserted = await this.repository.createBatch(batch);
          job.inserted += inserted;
          job.processed += batch.length;
          if (fileSummary) {
            fileSummary.inserted += inserted;
            fileSummary.processed += batch.length;
            fileSummary.progressPercent = fileSummary.total > 0 ? Math.round((fileSummary.processed / fileSummary.total) * 100) : 100;
          }
        },
        (batch, batchIndex, offset, error) => {
          job.failed += batch.length;
          job.processed += batch.length;
          job.failedBatches.push({ batchIndex, offset, count: batch.length, error });
          if (fileSummary) {
            fileSummary.failed += batch.length;
            fileSummary.processed += batch.length;
            fileSummary.errors.push(error);
            fileSummary.progressPercent = fileSummary.total > 0 ? Math.round((fileSummary.processed / fileSummary.total) * 100) : 100;
          }
        },
      );

      job.progressPercent = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 100;
    }

    job.status = 'completed';
    job.currentPhase = 'completed';
    job.currentFile = null;
    job.finishedAt = new Date().toISOString();
  }

  private async executeTest(query: string, expectedTools: string[]): Promise<ComputedResult> {
    const preview = await this.preview.previewRouting(query);
    const actualTools = preview.finalTools?.length
      ? preview.finalTools
      : preview.matches.map((m: any) => m.toolName);
    const actualSet = new Set(actualTools);
    const missingTools = expectedTools.filter((t) => !actualSet.has(t));
    const rawScores = (preview.finalToolScores ?? preview.matches.map((m: any, i: number) => ({
      toolName: m.toolName,
      similarity: m.similarity,
      matchLevel: i === 0 ? 'primary' : 'secondary',
    }))).map((s: any) => ({
      toolName: s.toolName,
      similarity: s.similarity,
      matchLevel: 'matchLevel' in s ? s.matchLevel : 'secondary',
    }));
    const scoreByTool = new Map<string, RoutingTestScore>(rawScores.map((s: RoutingTestScore) => [s.toolName, s]));
    const expectedScores = expectedTools
      .map((t) => scoreByTool.get(t))
      .filter((s): s is RoutingTestScore => Boolean(s));
    const confidence = expectedScores.length > 0
      ? Math.round(Math.min(...expectedScores.map((s) => s.similarity)) * 100)
      : Math.round((rawScores[0]?.similarity ?? 0) * 100);

    const routingThresholdPct = Math.round(
      (preview.config?.similarityThreshold ?? 0.5) * 100,
    );
    const hasLowConfidence = expectedScores.some(
      (s) => Math.round(s.similarity * 100) < routingThresholdPct,
    );

    let status: RoutingTestStatus;
    if (missingTools.length > 0) status = 'fail';
    else if (hasLowConfidence) status = 'low_confidence';
    else status = 'pass';

    return { status, confidence, actualTools, missingTools, scores: rawScores };
  }
}
