import { Inject, Service } from 'najm-core';
import { KnowledgeService } from './KnowledgeService';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';

interface CachedSearch {
  userText: string;
  result: Awaited<ReturnType<KnowledgeService['search']>>;
}

@Service()
export class KnowledgeContextProvider {
  constructor(
    @Inject() private knowledge: KnowledgeService,
    @Inject() private settings: RoutingSettingsService,
  ) {}

  private cache: CachedSearch | null = null;

  private async searchCached(userText: string) {
    if (this.cache && this.cache.userText === userText) {
      return this.cache.result;
    }
    const result = await this.knowledge.search(userText);
    this.cache = { userText, result };
    return result;
  }

  clearCache() {
    this.cache = null;
  }

  async getContext(userText: string): Promise<string | null> {
    const settings = await this.settings.getEffectiveSettings();
    if (!settings.enableKnowledge) return null;

    const result = await this.searchCached(userText);
    if (result.citations.length === 0) return null;

    const snippets = result.citations.map((citation, index) => {
      const source = citation.document.originalPath || citation.document.id;
      return `[${index + 1}] ${source}\n${citation.text}`;
    });

    return [
      'Use the following knowledge base excerpts when they are relevant to the user request.',
      ...snippets,
    ].join('\n\n');
  }

  async getContextTrace(userText: string): Promise<{
    used: boolean;
    chunks: Array<{
      chunkId: string;
      documentId: string;
      text: string;
      score: number;
      source?: string | null;
    }>;
  } | null> {
    const settings = await this.settings.getEffectiveSettings();
    if (!settings.enableKnowledge) return null;

    const result = await this.searchCached(userText);
    if (result.citations.length === 0) {
      return { used: false, chunks: [] };
    }

    return {
      used: true,
      chunks: result.citations.map((citation) => ({
        chunkId: citation.chunkId,
        documentId: citation.document.id,
        text: citation.text,
        score: citation.similarity,
        source: citation.document.originalPath || null,
      })),
    };
  }
}
