# Changelog

## 2.2.0

- Include optional `embeddings` in version-1 chat diagnostics using RAG's
  request-scoped DI bridge (najm-rag 2.4.0+). Streaming and runOnce preparation
  capture routing/context and MCP tool embeddings, and adjust all offsets to chat request
  start. Records retain cache status, actual attempts, timing and error category
  without query text, endpoint, credentials or raw embedding errors.
- Export `ChatEmbeddingSpan`. An empty array means capture was available with
  no calls; an absent field means capture was unavailable. The bridge is
  optional and adds no mandatory RAG runtime import. Existing older RAG and
  applications without the plugin retain their behavior.
