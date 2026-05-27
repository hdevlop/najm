export interface SemanticMatch {
  toolName: string;
  similarity: number;
}

export interface ToolEmbeddingRow {
  id: string;
  toolName: string;
  description: string;
  group: string | null;
  localName: string | null;
  argNames: string[] | null;
  annotations: Record<string, unknown> | null;
  fingerprint: string;
  embedding: number[] | Buffer | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SemanticPhraseRow {
  id: string;
  toolName: string;
  phrase: string;
  lang: string;
  source: string | null;
  sourceFile: string | null;
  embedding: number[] | Buffer | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PaginatedSemanticsResult {
  items: SemanticPhraseRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface SemanticGroup {
  lang: string;
  total: number;
}

export interface SemanticGroupsResult {
  groups: SemanticGroup[];
  total: number;
}

export interface ToolIndexInput {
  name: string;
  description: string;
  group?: string | null;
  localName?: string | null;
  argNames?: string[] | null;
  annotations?: Record<string, unknown> | null;
}

export interface ToolIndexEntry extends ToolIndexInput {
  fingerprint: string;
  text: string;
}

export interface UpsertEmbeddingData {
  toolName: string;
  description: string;
  group?: string | null;
  localName?: string | null;
  argNames?: string[] | null;
  annotations?: Record<string, unknown> | null;
  fingerprint: string;
  embedding: number[];
}

export interface UpsertSemanticData {
  toolName: string;
  phrase: string;
  lang: string;
  source?: string | null;
  sourceFile?: string | null;
  embedding?: number[] | null;
}
