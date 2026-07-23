import { Service } from 'najm-core';
import { UnmatchedQueryRepository } from './UnmatchedQueryRepository';
import type { UnmatchedQueryResponse, UnmatchedQueryRow } from './UnmatchedQueryDto';

@Service()
export class UnmatchedQueryService {
  constructor(private repository: UnmatchedQueryRepository) {}

  async recordMiss(data: {
    query: string;
    normalized: string;
    score: number;
    threshold: number;
    source?: string;
  }): Promise<void> {
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

  private toResponse(row: UnmatchedQueryRow): UnmatchedQueryResponse {
    return {
      id: row.id,
      query: row.query,
      normalized: row.normalized,
      score: Number(row.score ?? 0),
      threshold: Number(row.threshold ?? 0),
      source: row.source ?? null,
      occurrenceCount: row.occurrenceCount ?? 1,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }
}
