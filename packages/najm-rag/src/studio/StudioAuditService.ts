import { Service, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { RAG_SCHEMA } from '../tokens';
import type { RagSchema } from '../config';

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string | null;
  details: string;
  createdAt: string;
}

@Service()
export class StudioAuditService {
  @DB() private db: any;
  @Inject(RAG_SCHEMA) private schema!: RagSchema;

  async recordAudit(action: string, details: string, userId?: string | null): Promise<void> {
    try {
      const table = this.schema.chatbotStudioAuditLogs;
      if (!table) return;
      await this.db.insert(table).values({
        action,
        userId: userId ?? null,
        details,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[RAG Studio] Audit log write failed:', err instanceof Error ? err.message : err);
    }
  }

  async listAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const table = this.schema.chatbotStudioAuditLogs;
      if (!table) return [];
      const { desc } = await import('drizzle-orm');
      const rows = await this.db.select().from(table).orderBy(desc(table.createdAt)).limit(100);
      return (rows ?? []).map((r: any) => ({
        id: r.id,
        action: r.action,
        userId: r.userId ?? null,
        details: r.details ?? '',
        createdAt: r.createdAt,
      }));
    } catch {
      return [];
    }
  }
}
