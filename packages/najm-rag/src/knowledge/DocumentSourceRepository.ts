import { Repository, Inject } from 'najm-core';
import { DB } from 'najm-database';
import { eq, inArray, sql, desc } from 'drizzle-orm';
import { VECTOR_STRATEGY } from '../tokens';
import type { VectorStrategy } from '../vectorStore';
import type { DocumentSourceType, DocumentStatus } from './KnowledgeDto';
import { KnowledgeValidator } from './KnowledgeValidator';

export interface CreateDocumentSourceData {
  id?: string;
  namespace?: string;
  sourceType: DocumentSourceType;
  originalPath: string;
  ext?: string;
  mime?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentChunkData {
  documentId: string;
  ordinal: number;
  text: string;
  tokens: number;
  page?: number | null;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateDocumentEmbeddingData {
  chunkId: string;
  embedding: number[];
  model?: string;
  dimensions?: number;
}

export interface DocumentSourceRow {
  id: string;
  namespace: string;
  sourceType: string;
  originalPath: string;
  ext: string;
  mime: string;
  status: string;
  error: string | null;
  ingestedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkRow {
  id: string;
  documentId: string;
  ordinal: number;
  page: number | null;
  text: string;
  tokens: number;
  enabled: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

@Repository()
export class DocumentSourceRepository {
  @DB() declare db: any;
  @Inject(VECTOR_STRATEGY) private vectors!: VectorStrategy;
  @Inject() private validator!: KnowledgeValidator;

  async createSource(data: CreateDocumentSourceData): Promise<DocumentSourceRow> {
    const table = this.validator.sourcesTable();
    const values: Record<string, unknown> = {
      sourceType: data.sourceType,
      originalPath: data.originalPath,
      status: 'pending',
    };
    if (data.id) values.id = data.id;
    if (data.namespace) values.namespace = data.namespace;
    if (data.ext !== undefined) values.ext = data.ext;
    if (data.mime !== undefined) values.mime = data.mime;
    if (data.metadata !== undefined) values.metadata = data.metadata;

    const [row] = await this.db.insert(table).values(values).returning();
    return row;
  }

  async getSourceById(id: string): Promise<DocumentSourceRow | null> {
    const table = this.validator.sourcesTable();
    const [row] = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return row ?? null;
  }

  async listSources(namespace?: string): Promise<DocumentSourceRow[]> {
    const table = this.validator.sourcesTable();
    if (namespace) {
      return this.db.select().from(table).where(eq(table.namespace, namespace));
    }
    return this.db.select().from(table);
  }

  async updateSourceStatus(id: string, status: DocumentStatus, error?: string | null): Promise<void> {
    const table = this.validator.sourcesTable();
    const patch: Record<string, unknown> = {
      status,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    if (error !== undefined) patch.error = error;
    if (status === 'ready') patch.ingestedAt = new Date().toISOString();
    await this.db.update(table).set(patch).where(eq(table.id, id));
  }

  async deleteSource(id: string): Promise<void> {
    const chunksTable = this.validator.chunksTable();
    const embeddingsTable = this.validator.embeddingsTable();
    const sourcesTable = this.validator.sourcesTable();

    const chunks = await this.db.select({ id: chunksTable.id }).from(chunksTable).where(eq(chunksTable.documentId, id));
    const chunkIds = chunks.map((c: any) => c.id);

    if (chunkIds.length > 0) {
      await this.db.delete(embeddingsTable).where(inArray(embeddingsTable.chunkId, chunkIds));
      await this.db.delete(chunksTable).where(eq(chunksTable.documentId, id));
    }

    await this.db.delete(sourcesTable).where(eq(sourcesTable.id, id));
  }

  async countSources(namespace?: string): Promise<number> {
    const table = this.validator.sourcesTable();
    if (namespace) {
      const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table).where(eq(table.namespace, namespace));
      return row?.count ?? 0;
    }
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return row?.count ?? 0;
  }

  async createChunk(data: CreateDocumentChunkData): Promise<DocumentChunkRow> {
    const table = this.validator.chunksTable();
    const values: Record<string, unknown> = {
      documentId: data.documentId,
      ordinal: data.ordinal,
      text: data.text,
      tokens: data.tokens,
    };
    if (data.page !== undefined) values.page = data.page;
    if (data.enabled !== undefined) values.enabled = data.enabled;
    if (data.metadata !== undefined) values.metadata = data.metadata;

    const [row] = await this.db.insert(table).values(values).returning();
    return row;
  }

  async createChunks(dataList: CreateDocumentChunkData[]): Promise<DocumentChunkRow[]> {
    if (dataList.length === 0) return [];
    const table = this.validator.chunksTable();
    const rows = await this.db.insert(table).values(dataList.map((data) => {
      const values: Record<string, unknown> = {
        documentId: data.documentId,
        ordinal: data.ordinal,
        text: data.text,
        tokens: data.tokens,
      };
      if (data.page !== undefined) values.page = data.page;
      if (data.enabled !== undefined) values.enabled = data.enabled;
      if (data.metadata !== undefined) values.metadata = data.metadata;
      return values;
    })).returning();
    return rows;
  }

  async getChunksByDocumentId(documentId: string): Promise<DocumentChunkRow[]> {
    const table = this.validator.chunksTable();
    return this.db.select().from(table).where(eq(table.documentId, documentId));
  }

  async getChunkById(id: string): Promise<DocumentChunkRow | null> {
    const table = this.validator.chunksTable();
    const [row] = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return row ?? null;
  }

  async countChunks(): Promise<number> {
    const table = this.validator.chunksTable();
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return row?.count ?? 0;
  }

  async createEmbedding(data: CreateDocumentEmbeddingData): Promise<void> {
    const table = this.validator.embeddingsTable();
    const encoded = this.vectors.encodeEmbedding(data.embedding);
    await this.db.insert(table).values({
      chunkId: data.chunkId,
      embedding: encoded,
      model: data.model ?? '',
      dimensions: data.dimensions ?? 768,
    });
  }

  async createEmbeddings(dataList: CreateDocumentEmbeddingData[]): Promise<void> {
    if (dataList.length === 0) return;
    const table = this.validator.embeddingsTable();
    await this.db.insert(table).values(dataList.map((data) => ({
      chunkId: data.chunkId,
      embedding: this.vectors.encodeEmbedding(data.embedding),
      model: data.model ?? '',
      dimensions: data.dimensions ?? 768,
    })));
  }

  async deleteEmbeddingsByChunkIds(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const table = this.validator.embeddingsTable();
    await this.db.delete(table).where(inArray(table.chunkId, chunkIds));
  }

  async countEmbeddings(): Promise<number> {
    const table = this.validator.embeddingsTable();
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(table);
    return row?.count ?? 0;
  }

  async listSourcesWithChunkCount(namespace?: string): Promise<Array<DocumentSourceRow & { chunkCount: number }>> {
    const sourcesTable = this.validator.sourcesTable();
    const chunksTable = this.validator.chunksTable();

    const sources = await this.listSources(namespace);
    if (sources.length === 0) return sources.map((s) => ({ ...s, chunkCount: 0 }));

    const sourceIds = sources.map((s) => s.id);

    const chunkCounts = await this.db
      .select({
        documentId: chunksTable.documentId,
        count: sql<number>`count(*)`,
      })
      .from(chunksTable)
      .where(inArray(chunksTable.documentId, sourceIds))
      .groupBy(chunksTable.documentId);

    const countMap = new Map<string, number>(chunkCounts.map((r: any) => [r.documentId, Number(r.count)]));

    return sources.map((s) => ({
      ...s,
      chunkCount: countMap.get(s.id) ?? 0,
    }));
  }

  async deleteAllChunksForDocument(documentId: string): Promise<string[]> {
    const chunksTable = this.validator.chunksTable();
    const chunks = await this.db
      .select({ id: chunksTable.id })
      .from(chunksTable)
      .where(eq(chunksTable.documentId, documentId));

    const chunkIds = chunks.map((c: any) => c.id);

    if (chunkIds.length > 0) {
      const embeddingsTable = this.validator.embeddingsTable();
      await this.db.delete(embeddingsTable).where(inArray(embeddingsTable.chunkId, chunkIds));
      await this.db.delete(chunksTable).where(eq(chunksTable.documentId, documentId));
    }

    return chunkIds;
  }

  async listChunksPaginated(limit: number, offset: number): Promise<any[]> {
    const chunksTable = this.validator.chunksTable();
    return this.db
      .select()
      .from(chunksTable)
      .orderBy(desc(chunksTable.createdAt))
      .limit(limit)
      .offset(offset);
  }
}