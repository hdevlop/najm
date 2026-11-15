import { Inject, Meta, Service } from 'najm-core';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import { UnmatchedQueryRepository } from './UnmatchedQueryRepository';
import type { UnmatchedMiss, UnmatchedQueryResponse, UnmatchedQueryRow } from './UnmatchedQueryDto';
import { rewriteRoutingQuery } from '../toolRouter/ToolRouterUtils';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Service()
@Meta({ layer: 'plugin', order: 92 })
export class UnmatchedQueryService {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private repository: UnmatchedQueryRepository,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
  ) {}

  private get retentionDays(): number {
    const days = this.config?.unmatchedRetentionDays;
    return typeof days === 'number' && days > 0 ? days : 0;
  }

  async onReady(): Promise<void> {
    if (this.timer || this.retentionDays === 0) return;
    this.timer = setInterval(() => { void this.cleanup().catch(() => {}); }, CLEANUP_INTERVAL_MS);
    (this.timer as any)?.unref?.();
  }

  async onDestroy(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Deletes entries older than `unmatchedRetentionDays`; returns how many. */
  async cleanup(now = new Date()): Promise<number> {
    if (this.retentionDays === 0) return 0;
    return this.repository.deleteOlderThan(new Date(now.getTime() - this.retentionDays * DAY_MS));
  }

  async recordMiss(data: UnmatchedMiss): Promise<void> {
    if (!data.query.trim() || !data.normalized.trim()) return;
    await this.repository.record(data);
  }

  async list(limit?: number): Promise<UnmatchedQueryResponse[]> {
    const rows = await this.repository.list(limit);
    return rows.map((row) => this.toResponse(row));
  }

  async count(): Promise<{ count: number }> {
    return { count: await this.repository.count() };
  }

  async get(id: string): Promise<UnmatchedQueryResponse | null> {
    const row = await this.repository.findById(id);
    return row ? this.toResponse(row) : null;
  }

  async discard(id: string): Promise<{ deleted: boolean }> {
    await this.repository.deleteById(id);
    return { deleted: true };
  }

  async resolve(id: string): Promise<{ deleted: boolean }> {
    await this.repository.deleteById(id);
    return { deleted: true };
  }

  /**
   * The text routing would embed today, so a reviewer sees what the rewriter
   * made of the message. Computed on read: it follows rewriter changes.
   */
  private canonical(normalized: string): string | null {
    const rewrite = this.config?.rewriteRoutingQuery;
    if (!rewrite || !normalized) return null;
    try {
      return rewriteRoutingQuery(normalized, rewrite);
    } catch {
      return null;
    }
  }

  private toResponse(row: UnmatchedQueryRow): UnmatchedQueryResponse {
    return {
      id: row.id,
      query: row.query,
      normalized: row.normalized,
      canonical: this.canonical(row.normalized),
      score: Number(row.score ?? 0),
      threshold: Number(row.threshold ?? 0),
      source: row.source ?? null,
      nearestTool: row.nearestTool ?? null,
      occurrenceCount: row.occurrenceCount ?? 1,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }
}
