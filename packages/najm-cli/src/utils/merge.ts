export function shallowMergeRouting(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    // Preserve user maps; only overwrite scalars
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
      // For nested objects like embedding, merge shallowly
      result[key] = { ...(result[key] ?? {}), ...value };
    } else if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      result[key] = value;
    }
  }
  return result;
}

export function mergeSemanticsItems(
  target: Array<{ toolName: string; phrases: Array<{ lang?: string; phrase: string }> }>,
  source: Array<{ toolName: string; phrases: Array<{ lang?: string; phrase: string }> }>,
): Array<{ toolName: string; phrases: Array<{ lang?: string; phrase: string }> }> {
  const result = [...target];
  const byToolName = new Map(result.map((item) => [item.toolName, item]));

  for (const sourceItem of source) {
    const existing = byToolName.get(sourceItem.toolName);
    if (!existing) {
      result.push(sourceItem);
      byToolName.set(sourceItem.toolName, sourceItem);
    } else {
      const existingPhrases = new Set(existing.phrases.map((p) => `${p.lang ?? 'en'}:${p.phrase.toLowerCase()}`));
      for (const phrase of sourceItem.phrases) {
        const key = `${phrase.lang ?? 'en'}:${phrase.phrase.toLowerCase()}`;
        if (!existingPhrases.has(key)) {
          existing.phrases.push(phrase);
          existingPhrases.add(key);
        }
      }
    }
  }

  return result;
}

export function dedupeArrayCI(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const lower = item.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
