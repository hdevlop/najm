# Changelog

## 3.7.2 - 2026-11-14

### Fixed

- Conversation memory keeps tool results. A turn that called a tool was saved
  without the result, so every later message in that session failed with
  `AI_MissingToolResultsError` until the call left the prompt window. A turn is
  now stored as one assistant message whose tool calls carry their result or
  error. Sessions saved by earlier releases recover: calls stored without a
  result are left out of the prompt.
- A session can only be continued by the user who started it. `POST /chat`
  accepted any `sessionKey`, put that session's history in the caller's prompt
  and then saved the session under the caller. Loading a session owned by
  another user, or by no user while signed in, now answers 403, and a save
  never reassigns the owner of an existing row.

### Changed

- `ConversationStore` has a `loadSession(key)` method returning the messages
  and owner (`StoredConversation`, exported).

## 3.7.1 - 2026-10-22

- Stop warning when importing PostgreSQL chatbot tables from `najm-chatbot/pg`.
  The entry point still owns chatbot settings and sessions; RAG compatibility
  tables remain available without changes to the schema.

## 3.7.0 - 2026-10-13

- On phones (a touch screen or a window 640px wide or less) the panel fills the
  screen instead of a 70% bottom sheet, with no frame and safe-area padding.
  The header hides the resize control there; custom headers read the new
  `HeaderSlotProps.canResize`.
- The header shows the assistant status instead of the provider and model.
- The launcher and header use the `BotMessageSquare` icon.
- The empty state shows only the suggestions, without the "Ready when you are"
  heading and icon.

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
