import { z } from 'zod';

export const knowledgeSearchDto = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
  threshold: z.number().min(0).max(1).optional(),
});

export type KnowledgeSearchDto = z.infer<typeof knowledgeSearchDto>;

export type DocumentSourceType = 'pdf' | 'text' | 'markdown' | 'image' | 'url';
export type DocumentStatus = 'pending' | 'extracting' | 'ready' | 'failed';

export interface KnowledgeCitationSource {
  id: string;
  namespace: string;
  sourceType: DocumentSourceType;
  originalPath: string;
  metadata: Record<string, unknown> | null;
}

export interface KnowledgeCitation {
  chunkId: string;
  similarity: number;
  text: string;
  page: number | null;
  ordinal: number;
  document: KnowledgeCitationSource;
}

export interface KnowledgeSearchResult {
  query: string;
  citations: KnowledgeCitation[];
}

export interface ChunkWithSource {
  chunkId: string;
  text: string;
  page: number | null;
  ordinal: number;
  docId: string;
  namespace: string;
  sourceType: string;
  originalPath: string;
  metadata: Record<string, unknown> | null;
}

export const ingestTextDto = z.object({
  sourceType: z.enum(['text', 'markdown']).default('text'),
  text: z.string().min(1),
  namespace: z.string().optional(),
  originalPath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  chunkOptions: z.object({
    targetTokens: z.number().int().min(50).max(5000).optional(),
    overlapTokens: z.number().int().min(0).max(500).optional(),
  }).optional(),
});

export type IngestTextDto = z.infer<typeof ingestTextDto>;

export const documentListDto = z.object({
  namespace: z.string().optional(),
});

export type DocumentListDto = z.infer<typeof documentListDto>;

export interface DocumentListItem {
  id: string;
  namespace: string;
  sourceType: DocumentSourceType;
  originalPath: string;
  ext: string;
  mime: string;
  status: DocumentStatus;
  error: string | null;
  ingestedAt: string | null;
  metadata: Record<string, unknown> | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkResponse {
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

export interface ReindexResult {
  documentId: string;
  chunks: number;
  embedded: number;
  failed: number;
}

export interface KnowledgeStatusResult {
  documents: number;
  chunks: number;
  embeddings: number;
}
