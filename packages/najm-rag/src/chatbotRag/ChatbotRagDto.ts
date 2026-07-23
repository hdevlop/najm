import { z } from 'zod';

export const semanticPhraseDto = z.object({
  lang: z.string().optional(),
  phrase: z.string().min(1),
});

export const createSemanticDto = z.object({
  toolName: z.string().min(1),
  phrase: z.string().min(1),
  lang: z.string().optional().default('und'),
});

export const updateSemanticDto = z
  .object({
    phrase: z.string().min(1).optional(),
    lang: z.string().optional(),
  })
  .refine((v) => v.phrase !== undefined || v.lang !== undefined, {
    message: 'At least one of phrase or lang must be provided',
  });

export const previewRoutingDto = z.object({
  query: z.string().min(1),
});

export { knowledgeSearchDto, ingestTextDto } from '../knowledge/KnowledgeDto';
export type { KnowledgeSearchDto, IngestTextDto } from '../knowledge/KnowledgeDto';

export const semanticImportItemDto = z.object({
  toolName: z.string().min(1),
  phrases: z.array(semanticPhraseDto).optional().default([]),
});

const legacyImportSemanticsDto = z.object({
  items: z.array(semanticImportItemDto).default([]),
});

const groupedImportSemanticsDto = z.record(z.string(), z.record(z.string(), z.array(z.string())));

export const importSemanticsDto = z.union([
  groupedImportSemanticsDto,
  legacyImportSemanticsDto,
]);

export type SemanticPhraseDto = z.infer<typeof semanticPhraseDto>;
export type SemanticImportItemDto = z.infer<typeof semanticImportItemDto>;
export type LegacyImportSemanticsDto = {
  items?: SemanticImportItemDto[];
};
export type GroupedImportSemanticsDto = Record<string, Record<string, string[]>>;
export type ImportSemanticsDto = LegacyImportSemanticsDto | GroupedImportSemanticsDto;
export type CreateSemanticDto = z.infer<typeof createSemanticDto>;
export type UpdateSemanticDto = z.infer<typeof updateSemanticDto>;
export type PreviewRoutingDto = z.infer<typeof previewRoutingDto>;

export type ImportSemanticStatus = 'inserted' | 'updated' | 'skipped';

export interface ImportSemanticResult {
  toolName: string;
  phrase: string;
  lang: string;
  status: ImportSemanticStatus;
  error?: string;
}

export interface SemanticPhraseEntry {
  toolName: string;
  phrase: string;
  lang: string;
  sourceFile?: string;
  index: number;
}

export interface SemanticImportState {
  entries: SemanticPhraseEntry[];
  results: ImportSemanticResult[];
}

export interface SemanticPhraseResponse {
  id: string;
  toolName: string;
  phrase: string;
  lang: string;
  source: string | null;
  sourceFile: string | null;
  hasEmbedding: boolean;
  confirmation?: {
    level?: 'notice' | 'warning' | 'danger';
    message?: string;
    resolvedMessage?: string;
  };
  createdAt: string | null;
  updatedAt: string | null;
  embeddingError?: string;
}

export interface PaginatedSemanticsResponse {
  items: SemanticPhraseResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface SemanticGroupResponse {
  lang: string;
  total: number;
}

export interface SemanticGroupsResponse {
  groups: SemanticGroupResponse[];
  total: number;
}

export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ImportJobPhase = 'parsing' | 'checking' | 'embedding' | 'saving' | 'completed';

export interface ImportJobFileSummary {
  fileName: string;
  total: number;
  processed: number;
  progressPercent: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ImportJobFailedBatch {
  batchIndex: number;
  offset: number;
  count: number;
  error: string;
}

export interface ImportJobState {
  jobId: string;
  status: ImportJobStatus;
  total: number;
  processed: number;
  progressPercent: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  currentPhase: ImportJobPhase;
  currentFile: string | null;
  errors: string[];
  files: ImportJobFileSummary[];
  failedBatches: ImportJobFailedBatch[];
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SemanticReindexResult {
  reindexed: number;
  skipped: number;
  failed: number;
}
