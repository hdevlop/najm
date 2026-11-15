import { DI, Inject, LoggerService, Service, type Container } from 'najm-core';
import { KnowledgeService } from './KnowledgeService';
import { RoutingSettingsService } from '../routingSettings/RoutingSettingsService';
import { EmbeddingLru } from '../embeddings';

type SearchResult = Awaited<ReturnType<KnowledgeService['search']>>;

const CONTEXT_CACHE_SIZE = 32;
/**
 * How long a cached search answers repeat questions. Ingest, reindex and
 * delete clear the cache in this process; the limit bounds staleness when
 * another instance changed the documents.
 */
const CONTEXT_CACHE_TTL_MS = 60_000;

/**
 * Sent to the model instead of excerpts when the search fails, so a failed
 * lookup neither fails the chat nor reads as "the documents say nothing".
 */
export const KNOWLEDGE_UNAVAILABLE_CONTEXT =
  'The knowledge base could not be searched for this message. If the answer depends on its documents, '
  + 'say they are unavailable right now instead of answering from memory.';

/** The part of the routing settings this provider reads. */
interface KnowledgeSettingsSource {
  getEffectiveSettings(): Promise<{ enableKnowledge: boolean; contextOverride?: 'auto' | 'none' }>;
}

/**
 * Clears the knowledge context cache after the documents change. The provider
 * is registered only when knowledge is enabled, so it is looked up, not injected.
 */
export function invalidateKnowledgeContext(container: Container | undefined): void {
  try {
    if (container?.has(KnowledgeContextProvider)) {
      (container.get(KnowledgeContextProvider) as KnowledgeContextProvider).clearCache();
    }
  } catch {
    // Cache invalidation must not fail a document change.
  }
}

@Service()
export class KnowledgeContextProvider {
  @DI() private container?: Container;
  private readonly explicitSettings?: KnowledgeSettingsSource;

  /**
   * `settings` is typed by an interface, so the container passes nothing for
   * it; routing settings exist only with tool routing and are looked up then.
   */
  constructor(
    @Inject() private knowledge: KnowledgeService,
    settings?: KnowledgeSettingsSource,
    @Inject(LoggerService) private log?: LoggerService,
  ) {
    this.explicitSettings = settings;
  }

  private cache = new EmbeddingLru<{ result: SearchResult; at: number }>(CONTEXT_CACHE_SIZE);
  private now = () => Date.now();

  private settingsSource(): KnowledgeSettingsSource | undefined {
    if (this.explicitSettings) return this.explicitSettings;
    try {
      return this.container?.has(RoutingSettingsService)
        ? this.container.get(RoutingSettingsService) as KnowledgeSettingsSource
        : undefined;
    } catch {
      return undefined;
    }
  }

  /** Knowledge is on unless the studio's routing settings turned it off. */
  private async knowledgeEnabled(): Promise<boolean> {
    const source = this.settingsSource();
    if (!source) return true;
    const settings = await source.getEffectiveSettings();
    return settings.enableKnowledge && settings.contextOverride !== 'none';
  }

  private async searchCached(userText: string): Promise<SearchResult> {
    const cached = this.cache.get(userText);
    if (cached && this.now() - cached.at < CONTEXT_CACHE_TTL_MS) return cached.result;
    const result = await this.knowledge.search(userText);
    this.cache.set(userText, { result, at: this.now() });
    return result;
  }

  clearCache() {
    this.cache.clear();
  }

  async getContext(userText: string): Promise<string | null> {
    if (!(await this.knowledgeEnabled())) return null;

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
    if (!(await this.knowledgeEnabled())) return null;

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
