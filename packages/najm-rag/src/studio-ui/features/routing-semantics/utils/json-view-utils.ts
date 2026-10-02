import type { SemanticPhraseResponse, GroupedSemanticsPayload } from '@/features/routing-semantics/types';
import type { ApiClient } from '@/lib/api';

export function toGrouped(semantics: SemanticPhraseResponse[]): GroupedSemanticsPayload {
  const result: GroupedSemanticsPayload = {};
  semantics.forEach(s => {
    if (!result[s.toolName]) result[s.toolName] = {};
    if (!result[s.toolName][s.lang]) result[s.toolName][s.lang] = [];
    result[s.toolName][s.lang].push(s.phrase);
  });
  return result;
}

export function getSemanticsSignature(payload: GroupedSemanticsPayload): string {
  const rows: string[] = [];
  for (const [toolName, langs] of Object.entries(payload)) {
    for (const [lang, phrases] of Object.entries(langs)) {
      for (const phrase of phrases) {
        rows.push(`${toolName}\u0000${lang}\u0000${phrase}`);
      }
    }
  }
  rows.sort();
  return rows.join('\u0001');
}

export function getSemanticsTextSignature(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isValidSemanticsPayload(parsed)) return null;
    return getSemanticsSignature(parsed);
  } catch {
    return null;
  }
}

export async function loadAllFilteredPhrases(
  apiClient: ApiClient,
  filters: { toolGroup?: string; toolName?: string; lang?: string; search?: string }
): Promise<SemanticPhraseResponse[]> {
  const allPhrases: SemanticPhraseResponse[] = [];
  let offset = 0;
  const limit = 250;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (filters.toolGroup) params.set('toolGroup', filters.toolGroup);
    if (filters.toolName) params.set('toolName', filters.toolName);
    if (filters.lang) params.set('lang', filters.lang);
    if (filters.search) params.set('search', filters.search);

    const data = await apiClient.get<{ items: SemanticPhraseResponse[]; offset: number; total: number }>(`/semantics?${params.toString()}`);
    allPhrases.push(...data.items);
    hasMore = data.items.length > 0 && (data.offset + data.items.length) < data.total;
    offset += data.items.length;
  }

  return allPhrases;
}

export function isValidSemanticsPayload(value: unknown): value is GroupedSemanticsPayload {
  if (typeof value !== 'object' || value === null) return false;
  for (const [toolName, langs] of Object.entries(value)) {
    if (typeof toolName !== 'string') return false;
    if (typeof langs !== 'object' || langs === null) return false;
    for (const [lang, phrases] of Object.entries(langs)) {
      if (typeof lang !== 'string') return false;
      if (!Array.isArray(phrases)) return false;
      if (!phrases.every(p => typeof p === 'string')) return false;
    }
  }
  return true;
}

interface ImportResult {
  results: Array<{ toolName: string; phrase: string; lang: string; status: 'inserted' | 'updated' | 'skipped'; error?: string }>;
}

export function extractGroupedPayload(raw: unknown): GroupedSemanticsPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  if (Array.isArray((raw as any).items)) {
    const result: GroupedSemanticsPayload = {};
    for (const item of (raw as any).items) {
      const toolName = typeof item?.toolName === 'string' ? item.toolName.trim() : '';
      if (!toolName) continue;
      for (const p of Array.isArray(item?.phrases) ? item.phrases : []) {
        const phrase = typeof p?.phrase === 'string' ? p.phrase.trim() : '';
        const lang = typeof p?.lang === 'string' && p.lang.trim() ? p.lang.trim() : 'und';
        if (!phrase) continue;
        result[toolName] ??= {};
        result[toolName][lang] ??= [];
        if (!result[toolName][lang].includes(phrase)) {
          result[toolName][lang].push(phrase);
        }
      }
    }
    return result;
  }

  if (isValidSemanticsPayload(raw)) return { ...raw };

  if ('tools' in (raw as any) && typeof (raw as any).tools === 'object' && !Array.isArray((raw as any).tools)) {
    return extractGroupedPayload((raw as any).tools);
  }

  return {};
}

export function mergeSemanticsPayload(existing: GroupedSemanticsPayload, incoming: GroupedSemanticsPayload): GroupedSemanticsPayload {
  const result: GroupedSemanticsPayload = {};
  for (const [tool, langs] of Object.entries(existing)) {
    result[tool] = { ...langs };
    for (const [lang, phrases] of Object.entries(langs)) {
      result[tool][lang] = [...phrases];
    }
  }
  for (const [tool, langs] of Object.entries(incoming)) {
    result[tool] ??= {};
    for (const [lang, phrases] of Object.entries(langs)) {
      result[tool][lang] ??= [];
      for (const phrase of phrases) {
        if (!result[tool][lang].includes(phrase)) {
          result[tool][lang].push(phrase);
        }
      }
    }
  }
  return result;
}

export async function handleJsonSave(
  editText: string,
  allFilteredPhrases: SemanticPhraseResponse[],
  apiClient: ApiClient,
  onRefresh: () => Promise<void>,
): Promise<{ inserted: number; updated: number; deleted: number; changed: boolean }> {
  const parsed = JSON.parse(editText) as GroupedSemanticsPayload;
  if (!isValidSemanticsPayload(parsed)) {
    throw new Error('Invalid structure. Expected { toolName: { lang: [phrases] } }.');
  }

  const newKeys = new Map<string, { toolName: string; lang: string; phrase: string }>();
  for (const [toolName, langs] of Object.entries(parsed)) {
    for (const [lang, phrases] of Object.entries(langs)) {
      for (const phrase of phrases) {
        newKeys.set(`${toolName}|${lang}|${phrase}`, { toolName, lang, phrase });
      }
    }
  }

  const existingKeyToId = new Map<string, string>();
  allFilteredPhrases.forEach(s => {
    existingKeyToId.set(`${s.toolName}|${s.lang}|${s.phrase}`, s.id);
  });

  const removedIds = allFilteredPhrases
    .filter(s => !newKeys.has(`${s.toolName}|${s.lang}|${s.phrase}`))
    .map(s => s.id);

  const addedPayload: GroupedSemanticsPayload = {};
  for (const [key, entry] of newKeys) {
    if (!existingKeyToId.has(key)) {
      if (!addedPayload[entry.toolName]) addedPayload[entry.toolName] = {};
      if (!addedPayload[entry.toolName][entry.lang]) addedPayload[entry.toolName][entry.lang] = [];
      addedPayload[entry.toolName][entry.lang].push(entry.phrase);
    }
  }

  const hasAdditions = Object.keys(addedPayload).length > 0;
  if (!hasAdditions && removedIds.length === 0) {
    return { inserted: 0, updated: 0, deleted: 0, changed: false };
  }

  const [deleteResult, importResult] = await Promise.all([
    removedIds.length > 0
      ? apiClient.post<{ deleted: number }>('/semantics/delete-batch', { ids: removedIds })
      : Promise.resolve({ deleted: 0 }),
    hasAdditions
      ? apiClient.post<ImportResult>('/semantics/import', addedPayload)
      : Promise.resolve<ImportResult>({ results: [] }),
  ]);

  const results = Array.isArray(importResult?.results) ? importResult.results : [];
  const inserted = results.filter(r => r.status === 'inserted').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const deleted = deleteResult?.deleted ?? 0;

  await onRefresh();

  return { inserted, updated, deleted, changed: true };
}
