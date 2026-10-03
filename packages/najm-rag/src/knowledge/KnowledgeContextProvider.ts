import { Inject, LoggerService, Service } from 'najm-core';
import { KnowledgeService } from './KnowledgeService';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { EmbeddingLru } from '../embeddings';

type SearchResult = Awaited<ReturnType<KnowledgeService['search']>>;

const CONTEXT_CACHE_SIZE = 32;

/**
 * Sent to the model instead of excerpts when the search fails, so a failed
 * lookup neither fails the chat nor reads as "the documents say nothing".
 */
export const KNOWLEDGE_UNAVAILABLE_CONTEXT =
  'The knowledge base could not be searched for this message. If the answer depends on its documents, '
  + 'say they are unavailable right now instead of answering from memory.';

@Service()
export class KnowledgeContextProvider {
  constructor(
    @Inject() private knowledge: KnowledgeService,
    @Inject() private settings: RoutingSettingsService,
    @Inject(LoggerService) private log?: LoggerService,
  ) {}

  private cache = new EmbeddingLru<SearchResult>(CONTEXT_CACHE_SIZE);

  private async searchCached(userText: string): Promise<SearchResult> {
    const cached = this.cache.get(userText);
    if (cached) return cached;
    const result = await this.knowledge.search(userText);
    this.cache.set(userText, result);
    return result;
  }

  clearCache() {
    this.cache.clear();
  }

  async getContext(userText: string): Promise<string | null> {
    const settings = await this.settings.getEffectiveSettings();
    if (!settings.enableKnowledge) return null;

    let result: SearchResult;
    try {
      result = await this.searchCached(userText);
    } catch (error) {
      this.log?.warn('[chatbot-rag] Knowledge search failed; answering without it:', error instanceof Error ? error.message : error);
      return KNOWLEDGE_UNAVAILABLE_CONTEXT;
    }
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
