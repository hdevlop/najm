import type { DocumentListItem, KnowledgeStatusResult } from '@/features/knowledge/types';

export function getKnowledgeNumber(
  status: KnowledgeStatusResult | null,
  modernKey: 'documents' | 'chunks' | 'embeddings',
  legacyKey: 'documentCount' | 'chunkCount' | 'embeddingCount',
): number {
  if (!status) return 0;
  const source = status as unknown as Record<string, unknown>;
  return Number(source[modernKey] ?? source[legacyKey] ?? 0);
}

export function documentDate(doc: DocumentListItem): number {
  const source = doc as unknown as Record<string, unknown>;
  const value = source.updatedAt ?? source.createdAt ?? doc.ingestedAt;
  const time = typeof value === 'string' ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function documentName(doc: DocumentListItem): string {
  const source = doc as unknown as Record<string, unknown>;
  return String(source.originalPath ?? source.name ?? doc.id);
}

export function documentStatus(doc: DocumentListItem): 'indexed' | 'pending' | 'error' {
  if (doc.status === 'ready') return 'indexed';
  if (doc.status === 'failed') return 'error';
  return 'pending';
}
