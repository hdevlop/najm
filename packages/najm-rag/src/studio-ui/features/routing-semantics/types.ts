// owner: routing-semantics
// Used by: routing-tests (via re-export), routing-lab (via re-export), chat, storage, settings

import type { MCPToolConfirmation } from '../routing-tools/types';
import type { JsonViewColors } from '../routing-tools/types';

// Semantic domain types
export interface SemanticPhraseResponse {
  id: string;
  phrase: string;
  toolName: string;
  lang: string;
  hasEmbedding: boolean;
  source?: string | null;
  sourceFile?: string | null;
  confirmation?: MCPToolConfirmation;
  createdAt: string;
  updatedAt: string;
  embeddingError?: string;
}

export interface PaginatedSemanticsResponse {
  items: SemanticPhraseResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface SemanticGroup {
  lang: string;
  total: number;
}

export interface SemanticGroupsResponse {
  groups: SemanticGroup[];
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

export type GroupedSemanticsPayload = Record<string, Record<string, string[]>>;

export interface LegacySemanticsExportPayload {
  items: Array<{
    toolName: string;
    phrases: Array<{
      phrase: string;
      lang?: string;
    }>;
  }>;
}

export type SemanticsExportPayload = GroupedSemanticsPayload | LegacySemanticsExportPayload;

export interface SemanticsImportResult {
  results: Array<{
    toolName: string;
    phrase: string;
    lang: string;
    status: 'inserted' | 'updated' | 'skipped';
    error?: string;
  }>;
}

export interface BulkSemanticItem {
  toolName: string;
  lang: string;
  phrase: string;
}

export interface BulkSemanticParseResult {
  items: BulkSemanticItem[];
  warnings: string[];
  countsByLang: Array<{ lang: string; total: number }>;
  error?: string;
}

export interface SemanticFormState {
  phrase: string;
  toolName: string;
  lang: string;
}

export function parseBulkSemanticJson(
  raw: string,
  selectedTool: string,
  allowedLangs?: string[],
): BulkSemanticParseResult {
  const warnings: string[] = [];
  const countsByLang = new Map<string, number>();
  const seen = new Set<string>();
  const items: BulkSemanticItem[] = [];

  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e: any) { return { items: [], warnings: [], countsByLang: [], error: `Invalid JSON: ${e.message}` }; }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { items: [], warnings: [], countsByLang: [], error: 'Root must be an object.' };
  }

  const values = Object.values(parsed as Record<string, unknown>);
  const isToolMap = values.every((v) => v && typeof v === 'object' && !Array.isArray(v));
  const isLangMap = values.every((v) => Array.isArray(v));

  let langMap: Record<string, unknown>;
  let toolName = selectedTool;

  if (isLangMap) {
    if (!selectedTool) return { items: [], warnings: [], countsByLang: [], error: 'Select a target tool first.' };
    langMap = parsed as Record<string, unknown>;
  } else if (isToolMap) {
    const tools = Object.keys(parsed as object);
    if (tools.length > 1) {
      return { items: [], warnings: [], countsByLang: [], error: 'Multiple tools detected. Use Import or paste one tool at a time.' };
    }
    toolName = tools[0];
    langMap = (parsed as any)[toolName];
    if (selectedTool && selectedTool !== toolName) {
      warnings.push(`JSON tool "${toolName}" overrides selected "${selectedTool}".`);
    }
  } else {
    return { items: [], warnings: [], countsByLang: [], error: 'Unsupported shape. Expect { lang: [phrases] } or { tool: { lang: [phrases] } }.' };
  }

  for (const [lang, arr] of Object.entries(langMap)) {
    if (!Array.isArray(arr)) { warnings.push(`"${lang}" is not an array — skipped.`); continue; }
    if (allowedLangs && allowedLangs.length && !allowedLangs.includes(lang)) {
      warnings.push(`Language "${lang}" not in allowedLangs — skipped.`);
      continue;
    }
    let count = 0;
    for (const rawItem of arr) {
      if (typeof rawItem !== 'string') continue;
      const phrase = rawItem.trim();
      if (!phrase) continue;
      const key = `${toolName}::${lang}::${phrase}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ toolName, lang, phrase });
      count++;
    }
    countsByLang.set(lang, count);
  }

  return {
    items,
    warnings,
    countsByLang: [...countsByLang.entries()].map(([lang, total]) => ({ lang, total })),
  };
}

export type SemanticsViewMode = 'table' | 'json' | 'files';

// Routing preview — owned by routing-semantics (lab and tests use this)
export interface RoutingPreviewResult {
  query: string;
  normalized: string;
  status: 'disabled' | 'routed' | 'fallback_all' | 'fallback_none' | 'router_error';
  matches: Array<{
    toolName: string;
    similarity: number;
    source: 'semantics' | 'embeddings';
  }>;
  finalToolScores?: Array<{
    toolName: string;
    similarity: number;
    source: 'semantics' | 'embeddings';
    matchLevel: 'primary' | 'secondary' | 'below_threshold';
  }>;
  dependencies: Array<{
    toolName: string;
    reason: string;
  }>;
  routingDecisions: Array<{
    toolName: string;
    kept: boolean;
    reason: 'primary' | 'dependency' | 'read_only' | 'dropped_as_alternative';
  }>;
  confirmations: Array<{
    toolName: string;
    level: 'notice' | 'warning' | 'danger';
    message?: string;
    resolvedMessage?: string;
  }>;
  finalTools: string[];
  error?: string;
  config: {
    maxTools: number;
    topSemanticHits: number;
    similarityThreshold: number;
    fallbackOnNoMatch: string;
    fallbackOnRouterError: string;
  };
}

// Re-exports for consumers
export type { IndexSettings, JsonViewColors, MCPToolConfirmation } from '../routing-tools/types';
