# Changelog

## 2.2.1

- Keep terminal diagnostics stable after cancellation: ignore late text, step,
  tool and finish callbacks once settled, extending the embedding capture guard.
  Aborted requests retain their original outcome and partial-capture marker.

## 2.2.0

- Include optional `embeddings` in version-1 chat diagnostics using RAG's
  request-scoped DI bridge (najm-rag 2.4.0+). Streaming and runOnce preparation
  capture routing/context and MCP tool embeddings, and adjust all offsets to chat request
  start. Records retain cache status, actual attempts, timing and error category
  without query text, endpoint, credentials or raw embedding errors.
- Export `ChatEmbeddingSpan`. An empty array means capture was available with
  no settled calls; an absent field means capture was unavailable.
  `embeddingsIncomplete` marks terminal outcomes with unfinished capture scopes;
  late completions cannot mutate the terminal diagnostics record. The bridge is
  optional and adds no mandatory RAG runtime import. Existing older RAG and
  applications without the plugin retain their behavior.
