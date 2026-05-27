import { randomUUID } from 'node:crypto';
import { Service, Inject, LoggerService } from 'najm-core';
import { StorageService } from 'najm-storage';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import type { DocumentSourceType } from './KnowledgeDto';
import { EmbeddingService } from '../embeddings';
import type { ExtractedPdfText } from './PdfExtractor';
import { DocumentSourceRepository, type CreateDocumentChunkData, type CreateDocumentEmbeddingData, type DocumentSourceRow } from './DocumentSourceRepository';
import { chunkDocument, type ChunkOptions, type DocumentChunkResult } from './ChunkingStrategy';
import { FileExtractor } from './FileExtractor';
import { analyzeUploadFile, extensionFromPath, mimeForSourceType } from './fileUtils';

export interface IngestTextOptions {
  sourceType: DocumentSourceType;
  text: string;
  namespace?: string;
  originalPath?: string;
  metadata?: Record<string, unknown>;
  chunkOptions?: ChunkOptions;
}

export interface IngestStoredFileOptions {
  documentId?: string;
  sourceType: DocumentSourceType;
  namespace?: string;
  originalPath: string;
  ext?: string;
  mime?: string;
  metadata?: Record<string, unknown>;
  chunkOptions?: ChunkOptions;
}

export interface IngestUploadOptions {
  file: File | Blob;
  namespace?: string;
  metadata?: Record<string, unknown>;
  chunkOptions?: ChunkOptions;
}

export interface IngestUploadResult extends IngestTextResult {
  sourceType: DocumentSourceType;
  originalPath: string;
  namespace: string;
  fileName: string | null;
  mime: string;
  size: number;
}

export interface IngestTextResult {
  documentId: string;
  sourceId: string;
  chunks: number;
  embedded: number;
  failed: number;
}

export interface ReindexResult {
  documentId: string;
  chunks: number;
  embedded: number;
  failed: number;
}

const EMBED_BATCH_SIZE = 20;

@Service()
export class DocumentIngestionService {
  @Inject() private storage?: StorageService;
  @Inject() private extractor!: FileExtractor;

  constructor(
    @Inject() private repository: DocumentSourceRepository,
    @Inject() private embedding: EmbeddingService,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject(LoggerService) private log: LoggerService,
  ) {}

  async ingestText(options: IngestTextOptions): Promise<IngestTextResult> {
    const { sourceType, text, namespace, originalPath, metadata, chunkOptions } = options;

    const sourceRow = await this.repository.createSource({
      sourceType,
      originalPath: originalPath ?? `text://${sourceType}`,
      namespace: namespace ?? this.config.knowledge?.namespace ?? 'rag',
      ext: sourceType === 'markdown' ? 'md' : sourceType === 'pdf' ? 'pdf' : 'txt',
      mime: mimeForSourceType(sourceType),
      metadata: { ...(metadata ?? {}), sourceText: text },
    });

    return this.ingestSourceText(sourceRow, text, chunkOptions);
  }

  async ingestStoredFile(options: IngestStoredFileOptions): Promise<IngestTextResult> {
    const sourceRow = await this.repository.createSource({
      id: options.documentId ?? randomUUID(),
      sourceType: options.sourceType,
      originalPath: options.originalPath,
      namespace: options.namespace ?? this.config.knowledge?.namespace ?? 'rag',
      ext: options.ext ?? extensionFromPath(options.originalPath),
      mime: options.mime ?? mimeForSourceType(options.sourceType),
      metadata: options.metadata,
    });

    try {
      const extracted = await this.extractor.extract(sourceRow);
      return this.ingestSourceText(sourceRow, extracted.text, options.chunkOptions, extracted.pdf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.repository.updateSourceStatus(sourceRow.id, 'failed', msg);
      return { documentId: sourceRow.id, sourceId: sourceRow.id, chunks: 0, embedded: 0, failed: 0 };
    }
  }

  async ingestUpload(options: IngestUploadOptions): Promise<IngestUploadResult> {
    if (!this.storage) {
      throw new Error('Knowledge RAG file upload requires StorageService');
    }

    const analysis = analyzeUploadFile(options.file);
    const documentId = randomUUID();
    const namespace = options.namespace ?? this.config.knowledge?.namespace ?? 'rag';
    const originalPath = `sources/${documentId}/original.${analysis.ext}`;

    await this.storage.saveFile(namespace, originalPath, options.file);

    const result = await this.ingestStoredFile({
      documentId,
      sourceType: analysis.sourceType,
      namespace,
      originalPath,
      ext: analysis.ext,
      mime: analysis.mime,
      metadata: {
        ...(options.metadata ?? {}),
        fileName: analysis.fileName,
        size: analysis.size,
      },
      chunkOptions: options.chunkOptions,
    });

    return {
      ...result,
      sourceType: analysis.sourceType,
      originalPath,
      namespace,
      fileName: analysis.fileName,
      mime: analysis.mime,
      size: analysis.size,
    };
  }

  private async ingestSourceText(
    sourceRow: DocumentSourceRow,
    text: string,
    chunkOptions?: ChunkOptions,
    pdf?: ExtractedPdfText,
  ): Promise<IngestTextResult> {
    const sourceId = sourceRow.id;

    try {
      await this.repository.updateSourceStatus(sourceId, 'extracting');
    } catch {
      // status update is informational
    }

    const chunks = chunkDocument(text, sourceRow.sourceType, chunkOptions, pdf);

    if (chunks.length === 0) {
      await this.repository.updateSourceStatus(sourceId, 'failed', 'No chunks produced from text');
      return { documentId: sourceId, sourceId, chunks: 0, embedded: 0, failed: 0 };
    }

    let chunkRows: any[];
    try {
      const chunkData: CreateDocumentChunkData[] = chunks.map((c) => ({
        documentId: sourceId,
        ordinal: c.ordinal,
        text: c.text,
        tokens: c.tokens,
        page: c.page ?? null,
        enabled: true,
      }));
      chunkRows = await this.repository.createChunks(chunkData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.repository.updateSourceStatus(sourceId, 'failed', `Chunk creation failed: ${msg}`);
      return { documentId: sourceId, sourceId, chunks: chunks.length, embedded: 0, failed: chunks.length };
    }

    const { embedded, failed } = await this.embedChunkRows(sourceId, chunkRows, false);

    const finalStatus = embedded > 0 ? 'ready' : 'failed';
    const finalError = embedded === 0 ? 'All embedding batches failed' : failed > 0 ? `${failed} chunks failed to embed` : null;
    await this.repository.updateSourceStatus(sourceId, finalStatus as any, finalError);

    return {
      documentId: sourceId,
      sourceId,
      chunks: chunks.length,
      embedded,
      failed,
    };
  }

  async reindexDocument(documentId: string, options?: ChunkOptions): Promise<ReindexResult> {
    const source = await this.repository.getSourceById(documentId);
    if (!source) {
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    await this.repository.updateSourceStatus(documentId, 'extracting');

    const extracted = await this.getSourceText(source);
    if (!extracted.text) {
      await this.repository.updateSourceStatus(documentId, 'failed', 'Could not retrieve source text for reindexing');
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    await this.repository.deleteAllChunksForDocument(documentId);

    const chunks = chunkDocument(extracted.text, source.sourceType, options, extracted.pdf);

    if (chunks.length === 0) {
      await this.repository.updateSourceStatus(documentId, 'failed', 'No chunks produced during reindex');
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    const chunkData: CreateDocumentChunkData[] = chunks.map((c) => ({
      documentId,
      ordinal: c.ordinal,
      text: c.text,
      tokens: c.tokens,
      page: c.page ?? null,
      enabled: true,
    }));
    const chunkRows = await this.repository.createChunks(chunkData);

    const { embedded, failed } = await this.embedChunkRows(documentId, chunkRows, true);

    const finalStatus = embedded > 0 ? 'ready' : 'failed';
    const finalError = embedded === 0 ? 'All reindex embedding batches failed' : failed > 0 ? `${failed} chunks failed to embed` : null;
    await this.repository.updateSourceStatus(documentId, finalStatus as any, finalError);

    return { documentId, chunks: chunks.length, embedded, failed };
  }

  async deleteStoredFiles(source: DocumentSourceRow): Promise<void> {
    if (!this.storage || !source.originalPath || source.originalPath.startsWith('text://')) return;

    try {
      await this.storage.delete(source.namespace, source.originalPath);
    } catch {
      // Best-effort cleanup: DB deletion should not be blocked by a missing file.
    }
  }

  private async embedChunkRows(
    documentId: string,
    chunkRows: any[],
    reindexing: boolean,
  ): Promise<{ embedded: number; failed: number }> {
    let embedded = 0;
    let failed = 0;

    for (let i = 0; i < chunkRows.length; i += EMBED_BATCH_SIZE) {
      const batch = chunkRows.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((row: any) => row.text);

      try {
        const embeddings = await this.embedding.embedBatch(texts);
        const embedData: CreateDocumentEmbeddingData[] = batch.map((row: any, j: number) => ({
          chunkId: row.id,
          embedding: embeddings[j],
          model: this.config.rag?.embedding?.model ?? 'embeddinggemma',
          dimensions: this.config.rag?.embedding?.dimensions ?? 768,
        }));
        await this.repository.createEmbeddings(embedData);
        embedded += batch.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const prefix = reindexing ? 'Reindex embedding batch failed' : 'Embedding batch failed';
        this.log.error?.(`[najm-rag] ${prefix} for document ${documentId}: ${msg}`);
        failed += batch.length;
      }
    }

    return { embedded, failed };
  }

  private async getSourceText(source: DocumentSourceRow): Promise<{ text: string | null; pdf?: ExtractedPdfText }> {
    if (source.originalPath?.startsWith('text://')) {
      const metadataText = typeof source.metadata?.sourceText === 'string' ? source.metadata.sourceText : null;
      if (metadataText) return { text: metadataText };

      const chunks = await this.repository.getChunksByDocumentId(source.id);
      return { text: chunks.sort((a, b) => a.ordinal - b.ordinal).map((c) => c.text).join('\n\n') || null };
    }

    try {
      const extracted = await this.extractor.extract(source);
      return { text: extracted.text, pdf: extracted.pdf };
    } catch {
      return { text: null };
    }
  }
}
