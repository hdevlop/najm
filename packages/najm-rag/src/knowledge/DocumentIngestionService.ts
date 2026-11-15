import { randomUUID } from 'node:crypto';
import { Service, Inject, DI, LoggerService, type Container } from 'najm-core';
import { StorageService } from 'najm-storage';
import { RAG_CONFIG } from '../tokens';
import type { RagMergedConfig } from '../config';
import type { DocumentSourceType } from './KnowledgeDto';
import { EmbeddingService } from '../embeddings';
import type { ExtractedPdfText } from './PdfExtractor';
import { DocumentSourceRepository, type CreateDocumentChunkData, type CreateDocumentEmbeddingData, type DocumentChunkRow, type DocumentSourceRow } from './DocumentSourceRepository';
import { invalidateKnowledgeContext } from './KnowledgeContextProvider';
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


/** Extension for a pasted source, also used for its stored file. */
function extensionForSourceType(sourceType: DocumentSourceType): string {
  return sourceType === 'markdown' ? 'md' : sourceType === 'pdf' ? 'pdf' : 'txt';
}

/** Where a pasted text body is kept, when it was saved as a file. */
function storedTextPath(source: DocumentSourceRow): string | null {
  const value = source.metadata?.storedPath;
  return typeof value === 'string' && value ? value : null;
}

/**
 * A source created from pasted text rather than an uploaded file. Its
 * `originalPath` is a label (`text://…` or a name such as `faq.md`), not a
 * path in storage, so it is never read or deleted as one.
 */
function isPastedText(source: DocumentSourceRow): boolean {
  return storedTextPath(source) !== null
    || source.originalPath?.startsWith('text://') === true
    || typeof source.metadata?.sourceText === 'string';
}

@Service()
export class DocumentIngestionService {
  @Inject() private storage?: StorageService;
  @Inject() private extractor!: FileExtractor;
  @DI() private container?: Container;

  constructor(
    @Inject() private repository: DocumentSourceRepository,
    @Inject() private embedding: EmbeddingService,
    @Inject(RAG_CONFIG) private config: RagMergedConfig,
    @Inject(LoggerService) private log: LoggerService,
  ) {}

  async ingestText(options: IngestTextOptions): Promise<IngestTextResult> {
    try {
      return await this.ingestTextInternal(options);
    } finally {
      invalidateKnowledgeContext(this.container);
    }
  }

  private async ingestTextInternal(options: IngestTextOptions): Promise<IngestTextResult> {
    const { sourceType, text, namespace, originalPath, metadata, chunkOptions } = options;
    const id = randomUUID();
    const resolvedNamespace = namespace ?? this.config.knowledge?.namespace ?? 'rag';
    const ext = extensionForSourceType(sourceType);
    const mime = mimeForSourceType(sourceType);
    const storedPath = await this.storePastedText(resolvedNamespace, id, ext, mime, text);

    const sourceRow = await this.repository.createSource({
      id,
      sourceType,
      originalPath: originalPath ?? `text://${sourceType}`,
      namespace: resolvedNamespace,
      ext,
      mime,
      // The body is kept as a file so it does not travel with every search
      // hit; without storage it falls back to metadata as before.
      metadata: { ...(metadata ?? {}), ...(storedPath ? { storedPath } : { sourceText: text }) },
    });

    return this.ingestSourceText(sourceRow, text, chunkOptions);
  }

  private async storePastedText(namespace: string, id: string, ext: string, mime: string, text: string): Promise<string | null> {
    if (!this.storage) return null;
    const path = `sources/${id}/original.${ext}`;
    try {
      await this.storage.saveFile(namespace, path, new Blob([text], { type: mime }));
      return path;
    } catch (err) {
      this.log.warn?.(`[najm-rag] Could not store pasted text as a file; keeping it in metadata: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async ingestStoredFile(options: IngestStoredFileOptions): Promise<IngestTextResult> {
    try {
      return await this.ingestStoredFileInternal(options);
    } finally {
      invalidateKnowledgeContext(this.container);
    }
  }

  private async ingestStoredFileInternal(options: IngestStoredFileOptions): Promise<IngestTextResult> {
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
      return await this.ingestSourceText(sourceRow, extracted.text, options.chunkOptions, extracted.pdf);
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

    let chunkRows: DocumentChunkRow[];
    try {
      chunkRows = await this.repository.createChunks(this.chunkData(sourceId, chunks));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.repository.updateSourceStatus(sourceId, 'failed', `Chunk creation failed: ${msg}`);
      return { documentId: sourceId, sourceId, chunks: chunks.length, embedded: 0, failed: chunks.length };
    }

    const vectors = await this.embedTexts(sourceId, chunkRows.map((row) => row.text), false);
    const embedded = await this.storeEmbeddings(chunkRows, vectors);
    const failed = chunkRows.length - embedded;

    const finalStatus = embedded > 0 ? 'ready' : 'failed';
    const finalError = embedded === 0 ? 'All embedding batches failed' : failed > 0 ? `${failed} chunks failed to embed` : null;
    await this.repository.updateSourceStatus(sourceId, finalStatus, finalError);

    return {
      documentId: sourceId,
      sourceId,
      chunks: chunks.length,
      embedded,
      failed,
    };
  }

  async reindexDocument(documentId: string, options?: ChunkOptions): Promise<ReindexResult> {
    try {
      return await this.reindexDocumentInternal(documentId, options);
    } finally {
      invalidateKnowledgeContext(this.container);
    }
  }

  /**
   * Builds the new chunks and vectors before touching the stored ones, so a
   * reindex during an embedding outage leaves the document searchable.
   */
  private async reindexDocumentInternal(documentId: string, options?: ChunkOptions): Promise<ReindexResult> {
    const source = await this.repository.getSourceById(documentId);
    if (!source) {
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    await this.repository.updateSourceStatus(documentId, 'extracting');

    const extracted = await this.getSourceText(source);
    if (!extracted.text) {
      await this.repository.updateSourceStatus(documentId, 'failed', 'Could not retrieve source text for reindexing; previous index kept');
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    const chunks = chunkDocument(extracted.text, source.sourceType, options, extracted.pdf);

    if (chunks.length === 0) {
      await this.repository.updateSourceStatus(documentId, 'failed', 'No chunks produced during reindex; previous index kept');
      return { documentId, chunks: 0, embedded: 0, failed: 0 };
    }

    const vectors = await this.embedTexts(documentId, chunks.map((chunk) => chunk.text), true);
    const ready = vectors.filter((vector) => vector !== null).length;
    if (ready === 0) {
      await this.repository.updateSourceStatus(documentId, 'failed', 'All reindex embedding batches failed; previous index kept');
      return { documentId, chunks: chunks.length, embedded: 0, failed: chunks.length };
    }

    // No network call between the delete and the inserts.
    await this.repository.deleteAllChunksForDocument(documentId);
    const chunkRows = await this.repository.createChunks(this.chunkData(documentId, chunks));
    const vectorByOrdinal = new Map(chunks.map((chunk, index) => [chunk.ordinal, vectors[index]]));
    const embedded = await this.storeEmbeddings(chunkRows, chunkRows.map((row) => vectorByOrdinal.get(row.ordinal) ?? null));
    const failed = chunkRows.length - embedded;

    const finalStatus = embedded > 0 ? 'ready' : 'failed';
    const finalError = embedded === 0 ? 'All reindex embedding batches failed' : failed > 0 ? `${failed} chunks failed to embed` : null;
    await this.repository.updateSourceStatus(documentId, finalStatus, finalError);

    return { documentId, chunks: chunks.length, embedded, failed };
  }

  async deleteStoredFiles(source: DocumentSourceRow): Promise<void> {
    if (!this.storage) return;
    const storedPath = storedTextPath(source);
    // A pasted source's originalPath is a label; only its own stored file is removed.
    const path = storedPath ?? (isPastedText(source) ? null : source.originalPath);
    if (!path) return;

    try {
      await this.storage.delete(source.namespace, path);
    } catch {
      // Best-effort cleanup: DB deletion should not be blocked by a missing file.
    }
  }

  private chunkData(documentId: string, chunks: DocumentChunkResult[]): CreateDocumentChunkData[] {
    return chunks.map((chunk) => ({
      documentId,
      ordinal: chunk.ordinal,
      text: chunk.text,
      tokens: chunk.tokens,
      page: chunk.page ?? null,
      enabled: true,
    }));
  }

  /** One vector per text, or null where its batch failed. */
  private async embedTexts(documentId: string, texts: string[], reindexing: boolean): Promise<Array<number[] | null>> {
    const vectors: Array<number[] | null> = [];
    // Match the embedder's request size so one failed request only fails its own chunks.
    const batchSize = this.config.rag?.embedding?.batchSize ?? 16;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        vectors.push(...await this.embedding.embedBatch(batch, 'document', 'document-index'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const prefix = reindexing ? 'Reindex embedding batch failed' : 'Embedding batch failed';
        this.log.error?.(`[najm-rag] ${prefix} for document ${documentId}: ${msg}`);
        vectors.push(...batch.map(() => null));
      }
    }
    return vectors;
  }

  /** Stores the vectors that exist; returns how many were stored. */
  private async storeEmbeddings(chunkRows: DocumentChunkRow[], vectors: Array<number[] | null>): Promise<number> {
    const data: CreateDocumentEmbeddingData[] = [];
    chunkRows.forEach((row, index) => {
      const embedding = vectors[index];
      if (!embedding) return;
      data.push({
        chunkId: row.id,
        embedding,
        model: this.config.rag?.embedding?.model ?? 'embeddinggemma',
        dimensions: this.config.rag?.embedding?.dimensions ?? 768,
      });
    });
    if (data.length === 0) return 0;
    try {
      await this.repository.createEmbeddings(data);
      return data.length;
    } catch (err) {
      this.log.error?.(`[najm-rag] Storing embeddings failed: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }

  private async getSourceText(source: DocumentSourceRow): Promise<{ text: string | null; pdf?: ExtractedPdfText }> {
    const storedPath = storedTextPath(source);
    if (storedPath) {
      const data = await this.storage?.get(source.namespace, storedPath).catch(() => null);
      return { text: data ? data.toString('utf8') : null };
    }

    if (isPastedText(source)) {
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
