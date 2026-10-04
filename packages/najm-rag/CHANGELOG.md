# Changelog

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
