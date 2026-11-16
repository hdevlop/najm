# Changelog

## 3.7.0 - 2026-11-16

### Added

- `rag({ rerankTools })`: an optional second judge after embedding search.
  The app's `rerank` receives the message and the best-scoring tools with
  their descriptions and returns one of them (or none) with a confidence.
  A pick at `selectAt` (0.85) leads the tool list with its dependencies and
  `keepRouterTools` (3) of the router's matches; at `promoteAt` (0.7) it moves
  to the top. Near misses down to `minSimilarity` can be rescued at
  `selectAt`. "None", a lower confidence, an unknown tool, a throw or no
  answer in `timeoutMs` (800) keeps the router's order. Chat routing and the
  studio preview share it and report it as `rerank`.

## 3.6.0 - 2026-11-16

### Added

- `rag({ rewriteRoutingPhrase })`: a separate rewrite for stored semantic
  phrases, defaulting to `rewriteRoutingQuery`. Use it when the message
  rewrite adds text a phrase should not carry, such as hint lines naming
  tools. Setting it marks phrases stale for "reindex semantics"; hosts that
  do not set it keep their vectors. `phraseRoutingText()` is exported.

### Fixed

- The studio destroys its router history when it unmounts; leaving and
  re-entering the studio in a host app no longer stacks `window.history`
  wrappers and popstate listeners.
- The Studio Assistant opens from an "Assistant" sidebar item instead of a
  floating button that covered every table's pagination footer.
  `StudioAssistant` takes controlled `open` / `onOpenChange`.
- Folder tiles and the breadcrumb in the studio's file views use najm-kit
  `Button` and `Checkbox`; a double-click no longer opens a folder twice.

### Removed

- The unmounted studio screens `AccessSettings`, `SettingsWorkspace` and
  `RagSettingsView` (never exported by `najm-rag/studio`).

## 3.5.0 - 2026-11-15

### Fixed

- Missing columns no longer break every studio read. Schema checks ran lazily,
  on the first query that called them, so a read that skipped the check (or a
  check rolled back with a host request transaction) left
  `chatbot_tool_semantics.source_file` missing and `/semantics`, `/settings`,
  `/status` and `/tools/list` returned 500. `RagSchemaService` now runs every
  check once at boot (`activate`), then compares the live tables with the
  exported schema. Failed settings and routing-test checks are retried instead
  of being marked done.
- The boot seed (`seedSemantics`) embeds and stores one embedding batch at a
  time (`embedding.batchSize`, default 16) instead of embedding everything
  first, so progress survives a restart or an error. Three failed batches in a
  row stop it until the next boot.
- The studio's JSON-view save and "Import JSON" go through
  `/semantics/import-jobs` and poll it; the synchronous import timed out on
  large files. A job from a JSON body stores no source file.
- The studio no longer logs "useInsertionEffect must not schedule updates."
  in Next.js hosts: same-URL history writes from the host no longer reload
  the router synchronously.
- The studio dashboard and MCP Tools screen show the server's error text.
- Studio UI review: the violet accent reaches icons and badges (a nested
  `.dark` wrapper reset it), dashboard panels show skeletons while loading,
  Routing Lab's query box sits below its title, Knowledge Chat has a header,
  tables share one gutter, and hand-built panels use najm-kit components.

### Added

- `schema` in `/status` and in the studio's new `GET /health`: `missing`
  (`table` / `table.column`) and a `message` such as "database is missing
  chatbot_tool_semantics.source_file: run your migrations". The dashboard
  shows it. `RagSchemaService`, `RagSchemaStatus` and `RagSchemaEnsurer` are
  exported.
- `seed` in `/status`: `state`, `done`/`total`, `inserted`, `failed`,
  `unknownTools` and `lastError`, shown on the dashboard, so a host logging at
  ERROR only can see why a seed did nothing. `seedSemantics(seed, { batchSize,
  onProgress })`; `RAG_SEED_STATUS` token; `SemanticSeedProgress` and
  `SemanticSeedStatus` types.

### Changed

- `ragStudio({ auth })` is documented as informational: the server never read
  it.

## 3.4.0 - 2026-11-15

### Added

- `seedSemantics`: phrases the app ships, in the studio's "Import JSON"
  format. After boot tool indexing, phrases not yet stored are added with
  source `seed`; stored ones are not touched or re-embedded, so restarts cost
  nothing and studio edits stay. Phrases for unregistered tools are skipped
  with a warning. New `SemanticPhraseService.seedSemantics(seed)` and the
  `SemanticSeed` and `SemanticSeedResult` types; `importSemantics` takes an
  optional `{ source }`.

## 3.3.0 - 2026-11-15

### Fixed

- The studio's routing preview and routing tests now make the same decision
  as chat routing; both call one shared pipeline. The preview followed tool
  dependencies one level deep while chat followed them transitively.
- Knowledge answers no longer go stale: the context cache is cleared when a
  document is ingested, reindexed or deleted, and entries expire after 60 s.
- `rag({ knowledge: true })` without tool routing now gives the chatbot
  knowledge context. Before, the context provider was registered only when
  routing was also on.
- A reindex that cannot embed (for example during an embedding outage) keeps
  the document's existing chunks and vectors instead of deleting them first.
- Pasted text documents with a label path such as `faq.md` can be reindexed;
  deleting one no longer deletes an unrelated stored file with that name.
- Search results and the document list no longer carry the full body of
  pasted text documents (`metadata.sourceText`), and knowledge search loads
  each source once instead of once per matching chunk. With storage
  available, new pasted text is saved as a file and metadata holds its path.
- The unmatched inbox records the user's latest message, not the last turns
  joined together, so "Map to tool" no longer saves multi-turn text as a
  semantic phrase. `scripts/cleanup-multiturn-routing-rows.ts` lists and,
  with `--apply`, deletes rows written by earlier releases.
- "Reindex semantics" re-embeds phrases whose vector came from a different
  embedding model or settings. Phrases now store a fingerprint; phrases saved
  by earlier releases have none and are re-embedded once. Status reports
  `staleSemanticCount`; `?force=true` re-embeds every phrase.
- `toolsOverride`, `contextOverride` and a chunk's `enabled` flag, stored by
  the studio settings, now take effect.
- With a `configPath`, a routing setting the JSON file leaves out keeps the
  value from `rag({ toolRouting })` or the default. Before, chat routing used
  its own constants for it (0.45 for `similarityThreshold`, 12 and 8 for
  `maxTools` and `topSemanticHits`), while the studio status showed the merged
  value.

### Changed

Routing picks different tools. Measured on the playground routing benchmark
(53 tools, 109 synthetic requests in six language groups, 10 small-talk
messages, `embeddinggemma`): the right first tool rose from 59% to 84%, and
small-talk messages given tools fell from 8 of 10 to 0.

- With an EmbeddingGemma model and no `queryPrefix`/`documentPrefix` set, the
  model's retrieval prompts are used (`task: search result | query: `,
  `title: none | text: `) and `similarityThreshold` defaults to 0.35. Setting
  either prefix, even to `''`, keeps your prompts and the 0.45 default. Tools
  re-embed on the next indexing run; run "reindex semantics" and reindex
  knowledge documents.
- Tools are ranked, not phrase rows, and phrases and descriptions are searched
  together: a tool scores the better of its best phrase and its description.
  The primary is the best-scoring tool. Before, descriptions were searched only
  when no phrase matched, and the primary was the tool with the highest sum of
  its top three phrases, which favoured tools with many phrases (8 points
  lower on the benchmark). `selectPrimaryTool` is still exported but routing no
  longer uses it.
- The latest message is routed first; the joined turns only when it matches
  nothing. Both are embedded in one request.
- Phrases are embedded through the routing pipeline (normalized, then
  `rewriteRoutingQuery`), and stored as typed. Existing phrases are stale until
  "reindex semantics" runs.
- `createDarijaQueryRewriter` removes tatweel, collapses stretched letters,
  turns Arabic-Indic digits into ASCII, rewrites joined `ما…ش` negation to
  `لم` plus the stem, strips present/future prefixes and the bare
  first-person `ن` before a fixed list of verbs, drops an object pronoun
  attached to an imperative (`زيدلي`, `حطها`), and its preset adds everyday
  verbs, quantities and courtesy words (payments and shop nouns stay with the
  app). `نشوف` now rewrites to `انظر`: its old `ارى` folded to `اري` ("show
  me"). On two held-out sets of new Darija messages, the right first tool rose
  from 29% to 45% on the first and from 48% to 52% on the second. Apps using it
  should bump `routingTextVersion` and run "reindex semantics".
- The Darija rewriter applies an app's `rewriteRules` to the message as typed,
  before prefixes and negation are rewritten; a rule such as `كنقلب على` no
  longer misses because the prefix was stripped first.
- Query embeddings default to a 4 s timeout (or `timeoutMs` if shorter) and a
  15 s failure cooldown, so an unreachable provider delays a message once
  instead of once per lookup. Set `queryFailureCooldownMs: 0` for the old
  behavior. Indexing keeps `timeoutMs`.
- Concurrent requests to embed the same text share one provider call; the
  joining call is reported with `cache: 'shared'` in embedding diagnostics.
  With a `rewriteRoutingQuery` and knowledge on, one message makes one
  embedding request. New `EmbeddingService.embedQueries(texts)`.
- Recording a routing miss no longer delays the routing result.

### Added

- `routingTextVersion`: bump it when you change `rewriteRoutingQuery` to mark
  phrases for re-embedding.
- `rewriteRoutingQueryOnMiss`: optional async rewrite (for example an LLM
  translation) for a message that matched nothing; routing runs once more on
  its result. Off unless set; 1.5 s limit; results cached per message.
- `unmatchedRetentionDays`: hourly deletion of unmatched entries not seen for
  that many days. Off unless set.
- `GET /rag-studio/routing-tests/summary` (MCP `rag_studio_routing_test_summary`):
  routing test pass rates overall and per language.
- The Darija rewriter accepts Latin-script (Arabizi) keys in `words`. None
  are preset.
- The unmatched inbox shows the closest tool below the threshold
  (`nearestTool`), preselected in "Map", and the text routing embeds after
  `rewriteRoutingQuery` (`canonical`, computed when the inbox is read).
  Entries recorded by earlier releases have no nearest tool.
- The studio dashboard shows how many phrases need a reindex
  (`staleSemanticCount`).
- `canonicalizeRoutingText(text, rewrite?)`: the text routing embeds for a
  message or phrase (normalized, then rewritten).
- `ensureSchema` (default true): set `false` when your migrations own the
  tables, and the plugin never runs `CREATE` or `ALTER`. A test checks that
  tables generated from the exported schema on SQLite and PostgreSQL need no
  runtime change.

### Documentation

- MySQL is not supported at runtime; `najm-rag/mysql` only defines the tables.

### Upgrading

- The semantics table gains a nullable `fingerprint` column and the unmatched
  queries table a nullable `nearest_tool` column. Both are added at runtime on
  first use; add them in your migrations if the database user cannot alter
  tables. Run "reindex semantics" once after upgrading.

## 3.2.0 - 2026-10-04

- Tool indexing removes the embeddings of tools that are no longer routable,
  so renamed or removed tools stop accumulating in the index. The result adds
  `removed`. An empty registry removes nothing.

## 3.1.0 - 2026-10-04

- Restore the 2.4.0 embedding diagnostics on the 3.x line: request-scoped
  `withEmbeddingDiagnostics`, the diagnostics types, the `RAG_DIAGNOSTICS` DI
  bridge and `EmbeddingService.clearQueryCache()`. The published 3.0.0 was cut
  without them.

## 3.0.0 - 2026-10-04

- Breaking: adopt Najm Kit 3 and the compatible Storage 4 peer contract; accept Auth 6 alongside Auth 4/5.
- Preserve the published 2.3.0 Darija query rewriter, its root exports, and najm-rag/query-rewrites subpath.
- Require Hono ^4.13.12.

## 2.4.0

- Add request-scoped `withEmbeddingDiagnostics`, public embedding/attempt
  diagnostics types, and the `RAG_DIAGNOSTICS` DI bridge. AsyncLocalStorage
  isolates concurrent requests. Sink failures do not change embedding results;
  work detached after a scope closes cannot append events.
- Report logical embedding calls and real provider attempts separately, with
  query/document/health purpose, operation, cache hit/miss/bypass, monotonic
  timing, provider/model, timeout bound and completed/timeout/unavailable/
  cooldown/error outcomes. Events omit text, vectors, endpoints, credentials
  and raw errors. Label routing, preview, knowledge and indexing callers.
- Expose instance-scoped `EmbeddingService.clearQueryCache()` for isolated
  measurements without clearing provider cooldown or other instances.

## 2.3.0

- Export `createDarijaQueryRewriter`, `DarijaQueryRewriteOptions` and
  `DarijaRewriteRule` from the root and the standalone `najm-rag/query-rewrites`
  entrypoint. The opt-in Moroccan Darija vocabulary helper works with the
  existing `rewriteRoutingQuery` hook in tool routing and preview.
- Accept app-specific word overrides (null disables a preset word) and literal
  `rewriteRules`. Preserve marking shadda, handle vowelled phrases/attached
  conjunctions and keep unrelated words and non-Arabic text unchanged. Apps
  own domain vocabulary. Existing semantic phrases and default routing behavior
  are unchanged; knowledge search and the original chat message are not rewritten.

## 2.2.0

- Add `embedding.queryTimeoutMs`: a timeout for query embeddings (tool routing,
  its preview and knowledge search) separate from indexing, which keeps
  `timeoutMs`. Defaults to `timeoutMs`, so nothing changes until it is set.
- Add `embedding.queryFailureCooldownMs` (default 0, off): after a query
  embedding times out or cannot reach the provider, further query embeddings
  fail immediately for that window instead of each waiting out the timeout.
  A success or a healthy health check closes it; indexing is never skipped.
  Timeouts and connection failures throw `EmbeddingUnavailableError`, with
  the same messages as before.
- Knowledge search no longer embeds the query while no document is indexed
  (`KnowledgeRepository.hasEmbeddings`).
- A failed knowledge search no longer fails the chat: the context provider
  logs a warning and returns `KNOWLEDGE_UNAVAILABLE_CONTEXT`, which tells the
  model the knowledge base could not be searched. Failures are not cached.

## 2.1.4

- Changing the embedding model re-indexes every tool. The tool fingerprint now
  covers the embedder (provider, model, dimensions, truncation and document
  prefix); before, a model change kept the old vectors, which were then
  searched with the new model's queries. `createFingerprint` takes the
  embedder as an optional second argument (`ToolIndexEmbedder`). Upgrading
  re-indexes all tools once.

## 2.1.3

- Add `rewriteRoutingQuery` to the rag config: a function that rewrites a
  normalized message before tool routing embeds it, for wording the embedding
  model handles poorly, such as a dialect. The result is normalized again; an
  empty result keeps the original message, and a rewrite that throws is a
  router error. The routing preview applies the same rewrite and reports the
  embedded text as `rewritten`. Knowledge search is unchanged.

## 2.1.2

- Ship the RAG Studio UI as `najm-rag/studio` (`RagStudioProvider`,
  `RagStudio`) plus `najm-rag/studio/styles.css`. Mount it on one page of the
  host app; it reuses the signed-in admin session and renders client-side.
  React and React DOM are optional peers, needed only for the UI.
- `ragStudio()` no longer requires `najm-chatbot`. The Studio Assistant is now
  opt-in: apps that use it must pass `ragStudio({ assistant: true })` alongside
  `studioAssistant()`.
- The chatbot settings sheet in Chat Debug is enabled by passing
  `chatSettingsPanel={AiSettingsPanel}` (from `najm-chatbot/react`) to the
  provider.

## 2.1.1

- Add opt-in shortening and normalization for longer OpenAI-compatible embedding
  vectors from models with Matryoshka dimension support. Strict size validation
  remains the default; storage is still fixed at 768 dimensions.
- Validate finite values before shortening and reject an all-zero shortened
  vector. Verified against local llama.cpp with Qwen3 Embedding 0.6B Q8.

## 2.1.0

- Support OpenAI-compatible embedding servers, including local llama.cpp, with
  optional server-side bearer authentication. Ollama remains the default.
- Bound embedding request batches, preserve response ordering, validate finite
  vectors, and use the same vector contract for health probes.
- Support explicit query/document prefixes and separate their query-cache keys.
  Existing defaults keep inputs unchanged. Semantic phrase create/update now use
  the same document purpose as batch indexing.
- Keep bundled schemas at 768 dimensions. Model/prefix changes require an explicit
  index rebuild; existing tool fingerprints do not include embedding configuration.

Validation: 221 package tests, package build/declarations, public API snapshot,
and local llama.cpp b11146 / EmbeddingGemma Q8 smoke on two CPU threads. Local
smoke is not VPS performance or application routing acceptance.
