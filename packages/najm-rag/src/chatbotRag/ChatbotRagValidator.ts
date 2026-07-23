import { Service } from 'najm-core';
import type {
  ImportSemanticResult,
  ImportSemanticsDto,
  ImportSemanticStatus,
  SemanticImportState,
  SemanticPhraseEntry,
} from './ChatbotRagDto';

@Service()
export class ChatbotRagValidator {
  normalizeSemanticImport(body: ImportSemanticsDto): SemanticImportState {
    const results: ImportSemanticResult[] = [];
    const entries: SemanticPhraseEntry[] = [];
    const seen = new Set<string>();

    for (const item of this.toSemanticImportItems(body)) {
      const toolName = item.toolName.trim();
      if (!toolName) continue;

      for (const phraseItem of item.phrases ?? []) {
        const phrase = phraseItem.phrase.trim();
        const lang = (phraseItem.lang ?? 'und').trim() || 'und';
        const key = `${toolName}\u0000${phrase}\u0000${lang}`;

        if (!phrase || seen.has(key)) {
          results.push({
            toolName,
            phrase,
            lang,
            status: 'skipped',
            error: seen.has(key) ? 'Duplicate in import file' : 'Empty phrase',
          });
          continue;
        }

        seen.add(key);

        entries.push({
          toolName,
          phrase,
          lang,
          index: results.length,
        });

        results.push({
          toolName,
          phrase,
          lang,
          status: 'skipped',
        });
      }
    }

    return { entries, results };
  }

  private toSemanticImportItems(body: ImportSemanticsDto): Array<{ toolName: string; phrases: Array<{ phrase: string; lang?: string }> }> {
    if ('items' in body && Array.isArray(body.items)) {
      return body.items;
    }

    const items: Array<{ toolName: string; phrases: Array<{ phrase: string; lang?: string }> }> = [];
    for (const [toolName, langs] of Object.entries(body)) {
      if (!langs || typeof langs !== 'object' || Array.isArray(langs)) continue;

      const phrases: Array<{ phrase: string; lang?: string }> = [];
      for (const [lang, values] of Object.entries(langs)) {
        if (!Array.isArray(values)) continue;
        for (const phrase of values) {
          phrases.push({ phrase: String(phrase), lang });
        }
      }

      items.push({ toolName, phrases });
    }

    return items;
  }

  hasSemanticEntries(state: SemanticImportState): boolean {
    return state.entries.length > 0;
  }

  getSemanticImportPhrases(state: SemanticImportState): string[] {
    return state.entries.map((entry) => entry.phrase);
  }

  async resolveSemanticEmbeddings(
    embeddings: Promise<number[][]>,
    state: SemanticImportState,
  ): Promise<number[][] | null> {
    try {
      return await embeddings;
    } catch (error) {
      this.markSemanticImportFailed(state, error);
      return null;
    }
  }

  async resolveSemanticUpsert(
    upsert: Promise<ImportSemanticStatus>,
    state: SemanticImportState,
    entry: SemanticPhraseEntry,
  ): Promise<void> {
    try {
      const status = await upsert;
      this.markSemanticImportEntryComplete(state, entry, status);
    } catch (error) {
      this.markSemanticImportEntryFailed(state, entry, error);
    }
  }

  completeSemanticImport(state: SemanticImportState): { results: ImportSemanticResult[] } {
    return { results: state.results };
  }

  private markSemanticImportFailed(state: SemanticImportState, error: unknown): void {
    const message = this.getErrorMessage(error);
    for (const entry of state.entries) {
      this.markSemanticImportEntryFailed(state, entry, message);
    }
  }

  private markSemanticImportEntryComplete(
    state: SemanticImportState,
    entry: SemanticPhraseEntry,
    status: ImportSemanticStatus,
  ): void {
    state.results[entry.index] = {
      toolName: entry.toolName,
      phrase: entry.phrase,
      lang: entry.lang,
      status,
    };
  }

  private markSemanticImportEntryFailed(
    state: SemanticImportState,
    entry: SemanticPhraseEntry,
    error: unknown,
  ): void {
    state.results[entry.index] = {
      toolName: entry.toolName,
      phrase: entry.phrase,
      lang: entry.lang,
      status: 'skipped',
      error: this.getErrorMessage(error),
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
