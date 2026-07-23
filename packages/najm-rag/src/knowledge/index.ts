export { KnowledgeService } from './KnowledgeService';
export { KnowledgeContextProvider } from './KnowledgeContextProvider';
export { KnowledgeRepository } from './KnowledgeRepository';
export { KnowledgeValidator } from './KnowledgeValidator';
export { NoopOcrProvider, NoopCaptionProvider } from './OcrProvider';
export type { OcrProvider, CaptionProvider } from './OcrProvider';
export { PdfExtractor, setPdfParserForTests } from './PdfExtractor';
export type { ExtractedPdfText, ExtractedPdfPage } from './PdfExtractor';
export { TextChunker } from './TextChunker';
export type { ChunkResult, ChunkOptions } from './TextChunker';
export { MarkdownChunker } from './MarkdownChunker';
export type { MarkdownChunkOptions } from './MarkdownChunker';
export { DocumentSourceRepository } from './DocumentSourceRepository';
export type {
  CreateDocumentSourceData,
  CreateDocumentChunkData,
  CreateDocumentEmbeddingData,
  DocumentSourceRow,
  DocumentChunkRow,
} from './DocumentSourceRepository';
export { DocumentIngestionService } from './DocumentIngestionService';
export { FileExtractor } from './FileExtractor';
export { chunkDocument } from './ChunkingStrategy';
export type { DocumentChunkResult } from './ChunkingStrategy';
export { analyzeUploadFile, extensionFromPath, mimeForSourceType, sourceTypeFromUpload, extensionFromMime, mimeFromExtension } from './fileUtils';
export type { UploadAnalysis } from './fileUtils';
export { KnowledgeDocumentService } from './KnowledgeDocumentService';
export type { IngestTextOptions, IngestStoredFileOptions, IngestUploadOptions, IngestTextResult, IngestUploadResult, ReindexResult } from './DocumentIngestionService';
export { knowledgeSearchDto, ingestTextDto } from './KnowledgeDto';
export type {
  KnowledgeSearchDto,
  KnowledgeCitation,
  KnowledgeCitationSource,
  KnowledgeSearchResult,
  ChunkWithSource,
  DocumentSourceType,
  DocumentStatus,
  IngestTextDto,
  DocumentListItem,
  DocumentChunkResponse,
  KnowledgeStatusResult,
} from './KnowledgeDto';
