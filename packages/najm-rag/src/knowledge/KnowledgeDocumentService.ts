import { Service, Inject, HttpError } from 'najm-core';
import { DocumentSourceRepository } from './DocumentSourceRepository';
import { DocumentIngestionService } from './DocumentIngestionService';
import { KnowledgeService } from './KnowledgeService';
import type { DocumentListItem, DocumentChunkResponse, KnowledgeStatusResult, KnowledgeSearchResult } from './KnowledgeDto';
import type { IngestTextDto } from './KnowledgeDto';
import type { IngestTextResult, IngestUploadResult, ReindexResult } from './DocumentIngestionService';

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value && 'size' in value;
}

@Service()
export class KnowledgeDocumentService {
  constructor(
    @Inject() private docRepo?: DocumentSourceRepository,
    @Inject() private ingestion?: DocumentIngestionService,
    @Inject() private knowledge?: KnowledgeService,
  ) {}

  async listDocuments(namespace?: string): Promise<DocumentListItem[]> {
    if (!this.docRepo) return [];
    const rows = await this.docRepo.listSourcesWithChunkCount(namespace);
    return rows.map((r: any) => ({
      id: r.id,
      namespace: r.namespace,
      sourceType: r.sourceType,
      originalPath: r.originalPath,
      ext: r.ext,
      mime: r.mime,
      status: r.status,
      error: r.error,
      ingestedAt: r.ingestedAt,
      metadata: r.metadata,
      chunkCount: r.chunkCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunkResponse[]> {
    if (!this.docRepo) return [];
    const source = await this.docRepo.getSourceById(documentId);
    if (!source) HttpError.notFound(`Document not found: ${documentId}`);
    const chunks = await this.docRepo.getChunksByDocumentId(documentId);
    return chunks.map((c: any) => ({
      id: c.id,
      documentId: c.documentId,
      ordinal: c.ordinal,
      page: c.page,
      text: c.text,
      tokens: c.tokens,
      enabled: c.enabled,
      metadata: c.metadata,
      createdAt: c.createdAt,
    }));
  }

  async deleteDocument(documentId: string): Promise<{ deleted: boolean }> {
    if (!this.docRepo) return { deleted: false };
    const source = await this.docRepo.getSourceById(documentId);
    if (!source) HttpError.notFound(`Document not found: ${documentId}`);
    if (this.ingestion) {
      await this.ingestion.deleteStoredFiles(source);
    }
    await this.docRepo.deleteSource(documentId);
    return { deleted: true };
  }

  async reindexDocument(documentId: string): Promise<ReindexResult> {
    if (!this.ingestion) {
      HttpError.internal('Knowledge ingestion requires rag({ knowledge: true })');
    }
    return this.ingestion.reindexDocument(documentId);
  }

  async getKnowledgeStatus(): Promise<KnowledgeStatusResult> {
    if (!this.docRepo) return { documents: 0, chunks: 0, embeddings: 0 };
    const documents = await this.docRepo.countSources();
    const chunks = await this.docRepo.countChunks();
    const embeddings = await this.docRepo.countEmbeddings();
    return { documents, chunks, embeddings };
  }

  async listDocumentChunksWithPagination(limit: number, offset: number): Promise<DocumentChunkResponse[]> {
    if (!this.docRepo) return [];
    const rows = await this.docRepo.listChunksPaginated(limit, offset);
    return rows.map((c: any) => ({
      id: c.id,
      documentId: c.documentId,
      ordinal: c.ordinal,
      page: c.page,
      text: c.text,
      tokens: c.tokens,
      enabled: c.enabled,
      metadata: c.metadata,
      createdAt: c.createdAt,
    }));
  }

  async searchKnowledge(query: string, limit?: number, threshold?: number): Promise<KnowledgeSearchResult> {
    if (!this.knowledge) {
      return { query, citations: [] };
    }
    return this.knowledge.search(query, limit, threshold);
  }

  async ingestTextDocument(dto: IngestTextDto): Promise<IngestTextResult> {
    if (!this.ingestion) {
      HttpError.internal('Knowledge ingestion requires rag({ knowledge: true })');
    }
    return this.ingestion.ingestText({
      sourceType: dto.sourceType,
      text: dto.text,
      namespace: dto.namespace,
      originalPath: dto.originalPath,
      metadata: dto.metadata as Record<string, unknown> | undefined,
      chunkOptions: dto.chunkOptions,
    });
  }

  async uploadDocument(formData: FormData): Promise<IngestUploadResult> {
    if (!this.ingestion) {
      HttpError.internal('Knowledge ingestion requires rag({ knowledge: true })');
    }

    const fileValue = formData.get('file');
    if (!isUploadFile(fileValue)) {
      HttpError.badRequest('Multipart upload requires a file field named "file".');
    }
    const file = fileValue as File;

    const metadataValue = formData.get('metadata');
    const chunkOptionsValue = formData.get('chunkOptions');

    let metadata: Record<string, unknown> | undefined;
    if (metadataValue && typeof metadataValue === 'string') {
      try { metadata = JSON.parse(metadataValue); } catch {}
    }

    let chunkOptions: { targetTokens?: number; overlapTokens?: number } | undefined;
    if (chunkOptionsValue && typeof chunkOptionsValue === 'string') {
      try { chunkOptions = JSON.parse(chunkOptionsValue); } catch {}
    }

    return this.ingestion.ingestUpload({
      file,
      namespace: formData.get('namespace') as string | undefined,
      metadata,
      chunkOptions,
    });
  }
}