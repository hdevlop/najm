// Helpers for routing-semantics feature

import type { BulkSemanticItem, BulkSemanticParseResult, SemanticsExportPayload } from '../types';

export function getPendingCount(phrases: Array<{ hasEmbedding?: boolean }>): number {
  return phrases.filter((p) => !p.hasEmbedding).length;
}

export function isValidSemanticsPayload(payload: unknown): payload is SemanticsExportPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if ('items' in payload) {
    return Array.isArray((payload as { items?: unknown }).items);
  }
  return Object.values(payload as Record<string, unknown>).every((langMap) => {
    if (!langMap || typeof langMap !== 'object' || Array.isArray(langMap)) return false;
    return Object.values(langMap as Record<string, unknown>).every((phrases) => Array.isArray(phrases));
  });
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