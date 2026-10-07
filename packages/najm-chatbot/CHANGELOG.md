# Changelog

## 3.4.0 - 2026-10-07

- Add explicitly enabled `reply.preparation`, with server-owned history/eligibility,
  a zero-grace readiness race and independent selection/late-settlement observers.
- Share preparation across streaming, text and debug paths. Early synchronous
  replies take precedence; winning plans retain the existing read-only MCP guards.
- Propagate request/stream cancellation, suppress late work and keep selection
  diagnostics stable. Mark application-owned preparation cost as unreported.
- Keep the existing synchronous reply API and disabled behavior compatible.

## 3.2.0 - 2026-10-04

- Add `chatbot({ openrouter })`: OpenRouter-only fields sent with every chat
  request when the AI settings provider is `openrouter`, such as host routing
  (`provider: { order: ['cerebras'], allow_fallbacks: true }`) and
  `reasoning: { effort: 'low' }`. `buildModel` accepts the same options.
- When the last two steps made exactly the same tool calls, the next step
  answers without tools (`answerAfterRepeatedToolCall`). A model retrying a
  failing call no longer loops to `maxSteps` and ends with no answer.

## 3.1.0 - 2026-10-04

- Restore the 2.2.0/2.2.1 embedding diagnostics on the 3.x line: optional
  `embeddings` in chat diagnostics, `ChatEmbeddingSpan`, `embeddingsIncomplete`
  and stable terminal diagnostics after cancellation. Requires najm-rag 3.1.0
  for capture. The published 3.0.0 was cut without them.

## 3.0.0 - 2026-10-04

- Breaking: update the optional RAG peer to Najm RAG 3; accept Auth 6 alongside Auth 4/5.
- Preserve the current AI SDK tool inputSchema adapter and chatbot APIs.

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
