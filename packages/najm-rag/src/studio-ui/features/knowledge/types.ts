// owner: knowledge (used by dashboard, chat, storage)

import type { KnowledgeView } from '@/shared/hooks/useWorkspace';

export interface RagKnowledgeViewProps {
  view?: KnowledgeView;
}

// Knowledge domain types
export interface DocumentListItem {
  id: string;
  sourceType: 'pdf' | 'text' | 'markdown' | 'image' | 'url';
  status: 'pending' | 'extracting' | 'ready' | 'failed';
  chunkCount: number;
  metadata: Record<string, unknown>;
  ingestedAt: string | null;
  error: string | null;
}

export interface DocumentChunkResponse {
  id: string;
  documentId: string;
  ordinal: number;
  page: number | null;
  text: string;
  tokens: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface KnowledgeStatusResult {
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  storageSizeBytes: number;
}

// Cross-feature re-exports
export type { SemanticPhraseResponse } from '../routing-semantics/types';
export type { RoutingPreviewResult } from '../routing-semantics/types';
export type { MCPTool } from '../routing-tools/types';
