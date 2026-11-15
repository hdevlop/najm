# Changelog

## Unreleased

### Fixed

- `ChatController` starts when an app loads it without `chatbot()`. 3.8.0
  injected the chatbot config to read `chatRequestLimits` and failed with
  `Not registered: "Symbol(najm:chatbot:config)"`; the config is now looked up,
  and without it the default limits apply.

## 3.8.0 - 2026-11-15

### Fixed

- The studio assistant read AI SDK 4 stream fields: answers showed
  "undefined", tool arguments were missing, and every tool call, including
  failed writes, was reported as successful.
- The chat debug trace never showed tool results, and could not report a
  failed or blocked call. It now reads each call's real outcome.
- Two identical messages without ids (a second "yes") are two turns; the
  second was dropped. A client that resends its whole history with a
  `sessionKey` no longer stores each answer twice. Stored history is the
  source of truth: only messages after the last resent answer are added.
  Regenerating an answer from the client does not replace the stored one.
- "Test connection" makes one short request to the provider and reports its
  error; it reported success without connecting. The key is never echoed.
- `ollama` and `custom` providers call `/chat/completions` instead of OpenAI's
  `/responses`, and an Ollama base URL ending in `/` or `/v1` is not doubled.
- `runOnce` and the debug endpoint have a time limit (`streamTimeout.totalMs`,
  default 120 s); a stalled provider held a WhatsApp turn open indefinitely.
- A session's expiry read back from PostgreSQL (a time without a zone) is
  read as UTC; on a server not running in UTC sessions expired hours early or
  late.

### Changed

- `GET /ai-settings` returns only provider, model and enabled state to users
  who are not administrators; the system prompt and base URL are admin-only.
- `POST /chat` validates its body: only user and assistant messages, at most
  200 messages and 32000 characters per message (`chatRequestLimits`).
- Tool results kept in conversation memory are cut at 4000 characters
  (`maxStoredToolResultChars`; 0 keeps them whole).
- Knowledge context and tool routing are prepared at the same time;
  `routingMs` and `contextMs` overlap in diagnostics.
- The router receives the latest message on its own as well as the routing
  text (`ToolRoutingRequest` from najm-mcp).

### Added

- `chatLogging.retentionDays`: hourly deletion of interaction logs older than
  that. Off unless set.
- `ensureSchema` (default true): set `false` when your migrations own the
  tables, and the AI settings and session repositories never run `ALTER`.

### Documentation

- MySQL is not supported at runtime; `najm-chatbot/mysql` only defines the
  tables. Sessions, settings and cleanup use SQL MySQL lacks.

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
