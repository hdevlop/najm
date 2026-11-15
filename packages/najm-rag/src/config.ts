export type RagDialect = 'sqlite' | 'pg' | 'mysql';

export type ToolRoutingFallback = 'all' | 'none';

export interface RagEmbeddingConfig {
  provider?: 'ollama' | 'openai-compatible';
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  /** Optional bearer key. Server configuration only; never exposed by RAG Studio. */
  apiKey?: string;
  /** Maximum inputs per HTTP request; batches are sent sequentially. Default: 16. */
  batchSize?: number;
  /** Opt in to shortening a longer MRL vector and normalizing the result. */
  truncateDimensions?: boolean;
  /** Model-specific retrieval prefixes. Empty by default for compatibility. */
  queryPrefix?: string;
  documentPrefix?: string;
  /**
   * Per-request timeout in milliseconds for embedding calls. Hung or slow
   * upstream models (e.g. Ollama model loading) are aborted after this
   * duration so the rest of the chat pipeline can fall back gracefully.
   * Defaults to 8000ms.
   */
  timeoutMs?: number;
  /**
   * Timeout in milliseconds for query embeddings: the live calls that route a
   * chat message and search the knowledge base. Indexing batches keep
   * `timeoutMs`, so a slow CPU model can index without giving every chat
   * question the same long wait. Defaults to 4000, or `timeoutMs` when that
   * is shorter.
   */
  queryTimeoutMs?: number;
  /**
   * After a query embedding times out or cannot reach the provider, further
   * query embeddings fail immediately for this many milliseconds instead of
   * each waiting out `queryTimeoutMs`. A success or a healthy health check
   * ends the window early. Indexing is not affected. Defaults to 15000; 0
   * turns it off.
   */
  queryFailureCooldownMs?: number;
  /**
   * Timeout in milliseconds for lightweight health checks. Health checks still
   * issue a real embedding request, so cold local models often need more than
   * a ping-sized timeout during app boot. Defaults to 15000ms.
   */
  healthTimeoutMs?: number;
}

export interface RagToolRoutingConfig {
  enabled?: boolean;
  maxTools?: number;
  topSemanticHits?: number;
  similarityThreshold?: number;
  fallbackOnRouterError?: ToolRoutingFallback;
  fallbackOnNoMatch?: ToolRoutingFallback;
  dependencies?: Record<string, string[]>;
  /**
   * Set from the studio's routing settings. `none` gives the model no tools
   * and `all` every routable tool, both without routing; `auto` routes.
   */
  toolsOverride?: 'auto' | 'none' | 'all';
}

export interface RagKnowledgeConfig {
  enabled?: boolean;
  namespace?: string;
  basePath?: string;
}

export interface RagConfig {
  dialect?: RagDialect;
  configPath?: string;
  embedding?: RagEmbeddingConfig;
  queryEmbeddingCacheSize?: number;
  indexOnBoot?: boolean;
  toolRouting?: RagToolRoutingConfig;
  /**
   * Rewrites a message before tool routing embeds it, for wording the
   * embedding model handles poorly, such as a dialect. Receives the
   * normalized message; its result is normalized again, and an empty result
   * keeps the original. Applies to tool routing and its preview, not to
   * knowledge search. A rewrite that throws is a router error.
   */
  rewriteRoutingQuery?: RoutingQueryRewrite;
  /**
   * Rewrites a stored semantic phrase before it is embedded. Defaults to
   * `rewriteRoutingQuery`, so phrases and messages are embedded the same way.
   * Set it when the message rewrite adds things a phrase should not carry,
   * for example hint lines that name tools: those pull every phrase toward
   * the hinted tools and make it longer to embed. A typical value keeps the
   * dialect normalization and drops the hints; `(text) => text` embeds
   * phrases as typed. Bump `routingTextVersion` when you change it, then
   * reindex semantics.
   */
  rewriteRoutingPhrase?: RoutingQueryRewrite;
  /**
   * Any string naming the current routing-text handling (for example the
   * rewriter's version). Changing it marks every semantic phrase stale so the
   * next "reindex semantics" re-embeds them; a function cannot be compared,
   * so bump this when you change `rewriteRoutingQuery`.
   */
  routingTextVersion?: string;
  /**
   * Optional second chance for a message that matched no tool, for example an
   * LLM call that translates Darija or Arabizi to MSA. Receives the
   * normalized message; routing runs once more on the result. It has 1.5 s
   * (then `signal` aborts); a failure, timeout or empty result keeps the
   * no-match outcome. Results are cached per message. Off unless set.
   */
  rewriteRoutingQueryOnMiss?: RoutingQueryRewriteOnMiss;
  knowledge?: boolean | RagKnowledgeConfig;
  /**
   * BCP-47 language codes allowed for semantic phrases. If omitted, all known
   * languages are offered. Consumed by routing settings and surfaced to the
   * RAG Studio. Example: ['en', 'fr', 'ar'].
   */
  allowedLangs?: string[];
  /**
   * Days to keep unmatched-query entries, which hold users' messages, after
   * they were last seen. An hourly pass deletes older ones. Unset keeps them
   * until they are mapped or discarded in the studio.
   */
  unmatchedRetentionDays?: number;
  /**
   * Let repositories create missing tables and columns on first use (default
   * true). Set false when your migrations own the schema: generate them from
   * the exported Drizzle schema, which holds every table and column.
   */
  ensureSchema?: boolean;
  /**
   * Semantic phrases the app ships, in the studio's JSON import format. After
   * boot tool indexing (so not with `indexOnBoot: false`), phrases not yet
   * stored are added with source `seed`; stored phrases are left as they are
   * and nothing is re-embedded, so phrases edited or added in the studio stay.
   * A seed phrase deleted or reworded in the studio comes back on the next
   * boot while it is in the seed (the reworded copy stays too): change or
   * remove it here to change or remove it for good. Phrases for tools that are
   * not registered are skipped with a warning. Pass the data (for example an
   * imported JSON file), not a path, so it also works in bundled apps.
   */
  seedSemantics?: SemanticSeed;
}

/** Same shape as the studio's "Import JSON" file. */
export interface SemanticSeed {
  items: Array<{ toolName: string; phrases: Array<{ phrase: string; lang?: string }> }>;
}

export type RoutingQueryRewrite = (normalized: string) => string;
export type RoutingQueryRewriteOnMiss = (normalized: string, options: { signal: AbortSignal }) => Promise<string | null> | string | null;

export interface RagMergedConfig {
  dialect: RagDialect;
  configPath?: string;
  allowedLangs?: string[];
  rewriteRoutingQuery?: RoutingQueryRewrite;
  rewriteRoutingPhrase?: RoutingQueryRewrite;
  rewriteRoutingQueryOnMiss?: RoutingQueryRewriteOnMiss;
  routingTextVersion?: string;
  unmatchedRetentionDays?: number;
  /** False: repositories never change the schema. */
  ensureSchema?: boolean;
  /** Set only when it holds at least one item. */
  seedSemantics?: SemanticSeed;
  knowledge?: {
    enabled: boolean;
    namespace: string;
    basePath: string;
  };
  rag: {
    enabled: boolean;
    embedding: {
      provider: 'ollama' | 'openai-compatible';
      baseUrl: string;
      model: string;
      /** Unset means 768 for validation, and no `dimensions` field is sent to the provider. */
      dimensions?: number;
      apiKey?: string;
      batchSize?: number;
      truncateDimensions?: boolean;
      queryPrefix?: string;
      documentPrefix?: string;
      timeoutMs: number;
      queryTimeoutMs?: number;
      queryFailureCooldownMs?: number;
      healthTimeoutMs: number;
    };
    queryEmbeddingCacheSize: number;
    indexOnBoot: boolean;
  };
  toolRouting: {
    enabled: boolean;
    maxTools: number;
    topSemanticHits: number;
    similarityThreshold: number;
    fallbackOnRouterError: ToolRoutingFallback;
    fallbackOnNoMatch: ToolRoutingFallback;
    dependencies: Record<string, string[]>;
  };
}

export interface RagSchema {
  chatbotToolEmbeddings: any;
  chatbotToolSemantics: any;
  chatbotRoutingSettings: any;
  chatbotDocumentSources?: any;
  chatbotDocumentChunks?: any;
  chatbotDocumentEmbeddings?: any;
  chatbotStudioAuditLogs?: any;
  chatbotUnmatchedQueries?: any;
  chatbotRoutingTests?: any;
}
