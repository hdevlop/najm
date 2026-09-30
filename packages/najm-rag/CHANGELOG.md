# Changelog

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
