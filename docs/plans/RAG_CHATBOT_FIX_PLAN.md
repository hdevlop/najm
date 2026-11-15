# Fix plan: najm-chatbot and najm-rag

Written 2026-11-14 from a review of `packages/najm-chatbot` and `packages/najm-rag` at commit `e473f97` (najm-chatbot 3.7.1, najm-rag 3.2.0, `ai` 6.0.234).

Each item says how well the problem is established:

- **Reproduced**: a script or test against the installed packages showed the failure.
- **By reading**: the code path was traced but not executed.
- **Unverified**: a suspicion to confirm before spending time on a fix.

## Status (2026-11-14, branch `fix/rag-chatbot-plan`)

| Item | Status | Note |
| --- | --- | --- |
| C1, C2 | Done on master in `fa64fad` (3.7.2) | This branch adds the D1 cap (`maxStoredToolResultChars`, 4000). |
| C3–C8 | Done | C6 uses 16 output tokens, not 1: OpenAI's Responses API rejects lower limits. |
| R1–R5 | Done | R3 also fixed reindex and delete for pasted text with a label path such as `faq.md`. |
| T1–T4 | Done | T1: the query timeout is 4 s or `timeoutMs` if shorter. |
| Q0 | Done | Found and fixed: the preview followed dependencies one level deep, chat transitively. |
| Q1–Q3 | Done | Measured first; the real router scores 84% right primary, 0 of 10 small talk given tools. Q1's primary is the best score (the top-three sum scored 8 points lower). |
| Q4 | Dropped | Measured as a loss with retrieval prompts. |
| DR0 | Done with synthetic data | Per-language pass rates (`/routing-tests/summary`) and a synthetic 119-case set with a benchmark script. Replace with real messages when an app has them. |
| DR1 | Steps 2–3 done | Fingerprint, forced reindex, stale count in status and on the studio dashboard. Step 1 done (`canonicalizeRoutingText`). |
| DR2, DR4 | Done, with more preset words | Measured again on new Darija sets (see "Darija tuning"). Shipped in `createDarijaQueryRewriter`. |
| DR6 | Done | Package default for EmbeddingGemma models when no prefix is set: retrieval prompts and threshold 0.35. |
| DR3 | Steps 1 and 4 done | Arabizi phrases are in the playground seed. Steps 2–3 (Latin preset) dropped: measured as a small loss. |
| DR5 | Step 1 done | The inbox shows the nearest tool (preselected in "Map") and the canonical text. Step 2 is a review routine on real misses. |
| DR7 | Done, keep off | Opt-in hook, off by default (D5). Measured with local `qwen2.5:1.5b` (`--dr7`): 3 messages rescued, none to the right tool, +1 small talk given tools, +2 wrong write tools first; p50 0.9 s, p90 2.8 s. Untested with a hosted model (no API key here). |
| H1–H3, H5 | Done | Retention (H3) is off unless configured. |
| H6 | Done for the read side | Reproduced in JS; not run against a PostgreSQL server (no credentials here). |
| H4 | Done | `ensureSchema: false` opt-out in both plugins; parity tests generate the schema with drizzle-kit and apply it to SQLite and PostgreSQL (PGlite, vector columns as `real[]`), then assert the runtime checks change nothing. The playground migration is not added: drizzle-kit also emits pending `users` drift from najm-auth. |
| H7 | Documented | MySQL is not supported at runtime (README of both packages). |
| H8 | Not done | The plan says measure first. |

## Measured (2026-11-14, `embeddinggemma` on local Ollama)

The numbers below come from a first harness that toggled prototypes of each held item (53 playground tools, 123 phrases, 119 cases: 109 requests in six language groups and 10 small-talk messages). The kept items are now in the code, and `bun packages/najm-rag/scripts/routing-benchmark.ts` runs the cases in [apps/playground/bench/routing](apps/playground/bench/routing) and the playground's `semantics.json` through the real `ToolRouterService`: 84% right primary, 0 of 10 small talk given tools. The phrases and cases are synthetic, written for the benchmark, not taken from real users; the Darija is not checked by a native speaker. A gap of 3 points or less is about 3 cases and within noise.

| Setup | Right primary tool | Small talk given tools |
| --- | --- | --- |
| Playground today (threshold 0.45) | 59% | 8 of 10 |
| Today, best threshold (0.5) | 61% | 5 of 10 |
| All kept items, threshold 0.35 | 85% | 0 of 10 |
| Same, threshold picked on half the cases, scored on the other half | 85% | 1 of 5 |

Model comparison (DR6 step 2, `routing-benchmark.ts --models`, each model with its model card's prompts, all at 768 values, right primary at the model's best threshold that gives no small talk tools): embeddinggemma 84% (0.35), nomic-embed-text-v2-moe 66% (0.35), granite-embedding:278m 65% (0.75), qwen3-embedding:0.6b cut to 768 59% (0.8). EmbeddingGemma stays the default. Granite routes more Arabizi right at a loose threshold (71%) but then gives every small-talk message tools.

Darija tuning (`routing-benchmark.ts --darija`, Arabic-script Darija and Darija mixed with French). A second set, `cases-darija-holdout.json` (68 requests, 8 small talk), was written before tuning and split in two: half A for tuning, half B scored once at the end. The first set overstated Darija: 84% there, 57% on half A, 29% on half B for the same setup. Results (right first tool, Darija + Darija-French):

| Setup | First set | Half A | Half B (untouched) | Wrong write first, half B |
| --- | --- | --- | --- | --- |
| Before | 36/41 | 20/32 | 9/31 | 5 |
| Rewriter: DR2 + DR4 + everyday words (shipped) | 36/41 | 23/32 | 14/31 | 2 |
| + app shop words (`words`) | 36/41 | 27/32 | 16/31 | 2 |

No setup gave small talk tools. Some shop words were taken from the held-out messages, so their gain is inflated. Tried and dropped: EmbeddingGemma's title prompt for phrases (much worse at every threshold), plain or titled tool text (no change), scoring both the rewritten and the original message (−1 to −2), description weights 0.9 and 1.1 (no gain), two extra Darija phrases per tool (+1 on half A, −1 to −3 on the first set; inconclusive). Darija on new wording stays around 50%: the next gain needs real user messages, both as phrases and as tests.

Third set, `cases-darija-fresh.json` (2026-11-14: 96 requests including 21 for admin tools with no phrase, 16 small talk), frozen before its first run. First score with the shipped rewriter: 44% (39% without it), 2 of 16 small talk given tools, 11 wrong write tools first. Most misses got no tool: the best score was under 0.35, not a wrong tool. Tuned on half A, confirmed once on half B:

| Setup | Half A | Half B (untouched) | Wrong write first, half B | Old held-out set | Main set |
| --- | --- | --- | --- | --- | --- |
| Shipped before | 19/48 (40%) | 23/48 (48%) | 5 | 37/63 | 84% (Darija 84%) |
| + first-person `ن`, attached object pronoun, 25 words, `نشوف` → `انظر` (shipped) | 23/48 (48%) | 25/48 (52%) | 4 | 37/63 | 85% (Darija 87%) |

Wrong writes on half A: 6 → 4. Small talk unchanged (1 of 8 per half). Writing the tests also found an ordering bug: verb prefixes were stripped before an app's `rewriteRules` ran, so a rule in the user's wording (`كنقلب على`) never matched; rules now run first.

Tried and dropped on half A: a lower threshold (0.30: +8 points, but small talk given tools 1 → 3 and wrong writes 6 → 11), a margin a write tool must clear above the threshold (0.08: wrong writes 4 → 1 on half A, but −13 points on the old held-out set and −2 on the main set), `عطيني` → `اعطني` (one right answer traded for one small-talk tool). The remaining misses are mostly French shop words written in Arabic script (`سبريمي`, `نكونيكطا`, `الكوموند`), which are app words, and admin tools with no Darija phrase.

Admin Darija phrases (playground `semantics.json`, 48 phrases for 24 user, role, permission and health tools). A fourth set, `cases-darija-admin.json` (39 admin requests, 7 shop/own-account controls, 2 small talk), was frozen before the phrases were written; the phrases avoid its wording. The first version made own-account and shop requests go to admin tools (`دخلني بالإيميل ديالي` → `users_get_by_email`, `صلح الوصف ديال المنتوج` → `roles_update`); four phrases that shared those frames were rewritten, so the admin set is no longer untouched.

| Set | Right first tool before → after | Right tool given to the model | Wrong write first |
| --- | --- | --- | --- |
| Admin set | 30% → 46% | 35% → 57% | 6 → 10 |
| Third set (`cases-darija-fresh.json`) | 50% → 55% | 52% → 57% | 8 → 8 |
| Old held-out set | 59% → 59% | 62% → 62% | 6 → 6 |
| Main set | 85% → 85% | 88% → 88% | 3 → 3 |

End to end: 171 phrases imported, 93 of 109 right. The phrases pull a message to the right noun (user, role, permission) but often the wrong action among its siblings, which is where the extra wrong writes come from (`شحال من رول كاين` → `roles_update`). One own-account request still goes to an admin tool: `شنو الإيميل اللي مسجل بيه` → `users_get_by_email`.

Darija embedding model (stopped): `packages/najm-rag/training/darija-embedding/` fine-tunes EmbeddingGemma on DODa (CC BY-NC 4.0) in Colab and scores it locally with the benchmark (`DUMP_INPUTS` collects the texts, `--offline` reads Colab's vectors). Checked so far: the offline path reproduces the Ollama scores exactly; EmbeddingGemma in sentence-transformers gives the same vectors as Ollama's `embeddinggemma` (cosine 1.0000); a 3-step CPU run trains, saves and embeds. First full run (RunPod RTX 4090, `--mode pairs`: 148,260 contrastive Darija ↔ English/French/MSA pairs, one epoch): held-out Darija → English retrieval@1 0.26 → 0.84, but routing got worse at every threshold. Main set 85% → 70% (English 90% → 55%), small talk given tools 0 → 4 of 10 at 0.35; the three Darija sets 55/46/59% → 47/41/56%, though the right tool reached the model slightly more often (57/57/62% → 58/59/67%). The trained vectors were only 0.52 similar to the base: the whole space moved. Second run (`--mode distill`: Darija trained toward the frozen base model's embedding of the English translation, English/French/MSA trained to stay): English was kept (Latin-script texts 0.96 similar to the base; English messages still matched English phrases 16 of 20, base 18), but Arabic-script texts moved (0.76) and were squeezed together (different tools' phrases 0.42 → 0.51 similar), small-talk scores rose (max 0.33 → 0.48) and Arabic fell 83% → 75%. At the threshold giving about as few small-talk tools as the base at 0.35: main set 85% → 80% (@0.40), Darija sets 55/46/59% → 50/48/46%. The right tool reached the model more often (57/57/62% → 63/63/62%), so Darija understanding improved but ranking did not. Verdict: general conversational Darija (DODa) does not improve routing with either method; the data teaches everyday chat, not telling short commands apart. Not pursued further; training could be retried with in-domain data (real messages mapped to tools).

Safety: the benchmark and the end-to-end script count messages whose first tool is a write tool the message did not ask for. Current setup: 3 (two Arabic "delete everything from the cart" messages go to `products_delete` and `orders_checkout`, and one Arabizi health question goes to `cart_clear`); without the EmbeddingGemma prompts: 14. Write tools still ask for confirmation. The two cart cases are a phrase gap for `cart_clear` in Arabic; they were left unfixed so the test set stays a fair test.

End to end (`apps/playground/scripts/routing-e2e.ts`: the playground server on a database copy, sqlite-vec, the indexer, the import and reindex): 92 of 109 right primary, 0 of 10 small talk given tools, the same per language as the benchmark. Its first run found the `configPath` bug: settings missing from routing.json fell back to the router's constants (0.45), not the merged config, which cost 12 points.

Ablation from the full setup (right primary tool; full = 85%): without Q1+Q2 75% (Q1 only 82%), without DR3 phrases 77% (Arabizi 62%→24%), without DR6 prompts 78% and 5 small-talk false positives, without DR1 79% (Arabic-script Darija 87%→68%), without the rewriter and DR4 81% (Darija 87%→71%), without Q3 82%, without DR4 84%, without DR2 85%.

Verdicts:

- **Keep:** Q1+Q2, Q3, DR1 step 1, DR6 retrieval prompts (`queryPrefix: 'task: search result | query: '`, `documentPrefix: 'title: none | text: '`) **with the threshold lowered to about 0.35** (at 0.45 the full setup drops to 73%), DR3 step 4 (Arabizi example phrases), the shipped Darija rewriter.
- **Drop:** Q4 (with retrieval prompts it costs 7 points and lets 8 of 10 small-talk messages through; phrases keep the document prefix), DR3 steps 2–3 (the Latin preset costs 2 points, consistent with D6).
- **No measurable effect here:** DR2 and DR4 (only 4 and 4 cases exercise them). Keep them only if real messages show tatweel or negation failures.
- Harness limits: the Q2 prototype scores per tool, so it includes Q1; Q1's tie-break is best score, not the mean of the top three; tool text has no argument names.

## Order of work

| Phase | Items | Why this order |
| --- | --- | --- |
| 1. Blocking | C1, C2 | C1 breaks every conversation with memory after a tool call. C2 lets one signed-in user take another's session. |
| 2. Chatbot correctness | C3 to C8 | Wrong output or false "success" in existing features. |
| 3. RAG correctness | R1 to R5 | Stale or missing knowledge, and bad data entering the semantics table. |
| 4. Routing latency | T1 to T4 | Removes waits; does not change which tools are picked. |
| 5. Routing quality | Q0 to Q4 | Changes which tools are picked, so it needs a baseline first. |
| 5b. Darija routing | DR0 to DR7 | Same kind of change as Phase 5, for Moroccan Darija input. Needs its own test set. |
| 6. Hardening | H1 to H8 | Lower risk; schedule as time allows. |

Phases 1 to 3 are independent of each other. Phase 5 depends on Q0. T2 and R5 depend on the small interface change described in T2. Phase 5b depends on Q0 and DR0; DR5 depends on R5; DR1 and Q4 both change how phrases are embedded, so ship them together and reindex once.

Rules for every item:

- Write the failing test first, against real collaborators (real `streamText`/`generateText` with a mock model, real repository on SQLite). Several existing tests passed while the feature was broken because they tested a copy of the logic or hand-made fixtures.
- Do not change public exports without updating `src/index.ts`, `package.json` `exports`, and `najm-api` re-exports where they apply.

---

## Phase 1: blocking

### C1. Conversation breaks on the turn after a tool call (reproduced)

**Problem.** `appendResponseMessages` in [ChatAgent.ts:191-218](packages/najm-chatbot/src/agent/ChatAgent.ts#L191-L218) stores each tool call as a part with `state: 'input-available'` and drops the `tool` role messages that carry the results. On the next turn `convertToModelMessages` emits a tool call with no result and the SDK throws `AI_MissingToolResultsError: Tool result is missing for tool call <id>`. The error repeats until that message leaves the `maxPromptMessages` window. It affects `stream`, `runOnce` and `debugRun` whenever a `sessionKey` is used and memory is on.

**Change.**

1. In `appendResponseMessages`, first index the results: for every response message with `role: 'tool'`, map `toolCallId` to its `output`. The shape is `{ type: 'tool-result', toolCallId, toolName, output: { type: 'text' | 'json' | 'error-text' | 'error-json', value } }`.
2. Emit each tool call as one part that carries its result:
   - result present: `{ type: 'tool-<name>', toolCallId, state: 'output-available', input, output: <value> }`
   - error result: `{ ..., state: 'output-error', input, errorText: <string> }`
   - no result (step aborted): drop the part.
3. On the read side, call `convertToModelMessages(messages, { ignoreIncompleteToolCalls: true })` in `toModelMessages`. Rows already saved in the broken shape then load without error; no data migration is needed.
4. Cap what is stored: truncate a stored tool output above a limit (suggested `maxStoredToolResultChars`, default 4000) so sessions do not grow without bound. See decision D1.

Both stored shapes and the read-side option were checked against `ai` 6.0.234 and are accepted. A call and its result live in the same stored message, so the existing `slice(-n)` trimming cannot split a pair.

**Tests.** New file `packages/najm-chatbot/test/chat-tool-history.test.ts`:

- turn 1 makes a tool call, turn 2 on the same `sessionKey` succeeds, for `runOnce` and for `stream`;
- the provider prompt on turn 2 contains the tool result;
- a session saved in the old shape (`input-available`, no output) still answers on the next turn;
- an output longer than the cap is stored truncated.

**Done when** the new tests pass and `bun run --cwd packages/najm-chatbot test` is green.

### C2. A signed-in user can read and take over another user's session (by reading)

**Problem.** [ChatController.ts:23-26](packages/najm-chatbot/src/chat/ChatController.ts#L23-L26) passes the client's `sessionKey` to the agent. `loadStoredHistory` loads by key with no owner check, so the other user's history enters the caller's prompt. The save then sets `userId` to the caller in the conflict update ([ChatSessionRepository.ts:78-80](packages/najm-chatbot/src/sessions/ChatSessionRepository.ts#L78-L80)). After that `GET /chat/sessions/:key` returns the full session to the caller and 403 to the real owner. The playground's WhatsApp keys are `wa:<phone>`, so they can be guessed.

**Change.**

1. Add `loadWithOwner(key): Promise<{ messages: UIMessage[]; userId: string | null } | null>` to `ConversationStore`, implemented by `DbConversationStore` (from the row) and `CacheConversationStore` (from `payload.meta.userId`). Keep `load` for compatibility.
2. In `ChatAgent.loadStoredHistory`, compare the stored owner with `getCurrentUserId()`. If they differ, call `HttpError.forbidden('Session belongs to another user')`. Two `null` values are equal, so server-side callers with no user keep access to sessions that have no owner. See decision D2.
3. In `ChatSessionRepository.save`, remove `userId` from `updateSet`. The owner is set on insert and never changes afterwards.
4. Mention the rule in the README section on `sessionKey`: the key is not a secret, and ownership is enforced by the server.

**Tests.** Extend `chat-controller.test.ts` and `chat-session-upsert.test.ts`:

- user B posting to `/chat` with user A's key gets 403, A's stored messages are unchanged, and A still owns the row;
- the same for the cache store;
- a new key still creates a session owned by the caller;
- `runAsUser` for the owner still works (WhatsApp path).

**After release.** This is a security fix. List the apps that consume `najm-chatbot` and check each one's installed version; an app that has not upgraded is still affected. Add an entry to the package CHANGELOG.

---

## Phase 2: chatbot correctness

### C3. Studio assistant stream reads old SDK field names (reproduced)

**Problem.** `toStudioSse` in [StudioAssistantProviderService.ts:206-231](packages/najm-chatbot/src/studio-assistant/StudioAssistantProviderService.ts#L206-L231) reads `part.textDelta`, `part.args` and `part.result`. In `ai` 6 these are `part.text`, `part.input` and `part.output`. Text events carry no delta, so the UI appends the string "undefined"; tool arguments are missing; and every tool result is reported `ok: true`, including failed writes.

**Change.** Use `part.text`, `part.input`, `part.output`. Also handle `tool-error` parts by sending `tool_result` with `ok: false`. Add a `protected buildModel()` seam like `ChatAgent` has, so the service can be tested.

**Tests.** New `packages/najm-chatbot/test/studio-assistant.test.ts` that runs `run()` with a mock model through the real `streamText` and asserts on the parsed SSE events: text deltas are strings, `tool_call.args` equals the model's input, and a tool whose MCP result has `isError: true` yields `ok: false`.

**Done when** the test passes and, after `bun run build:rag` and a chatbot build, the assistant in the playground at `/rag-studio` shows readable text and a red status for a failing tool.

### C4. Debug trace never shows tool results or failures (reproduced)

**Problem.** `debugRun` in [ChatAgent.ts:563-612](packages/najm-chatbot/src/agent/ChatAgent.ts#L563-L612) reads `.result`, `.isError`, `.args` and `.isConfirmationBlocked`. None exist in `ai` 6, so `resultPreview` is always `{}` and the `error` and `blocked` statuses cannot occur. The test in [chat-debug.test.ts:231-249](packages/najm-chatbot/test/chat-debug.test.ts#L231-L249) re-implements the loop inside the test file, so it passes regardless.

**Change.**

1. Read arguments from `call.input` and results from `step.toolResults[].output`.
2. Take the status from the tool adapter instead of guessing from the SDK: pass a `ChatDiagnosticsRecorder` into `prepareReply` in `debugRun` and map each `toolCallId` to its recorded outcome (`executed`, `blocked`, `error`). The adapter already reports these through `onToolSettled`.
3. Delete the copied loop from `chat-debug.test.ts` and replace it with tests that call `debugRun` with a mock model and a stub `McpBuilderService`: one normal result, one `isError` result, one tool with `confirmation`.

### C5. Message merge drops repeats and duplicates assistant turns (reproduced for the first case)

**Problem.** `getMessageIdentity` in [ChatAgent.ts:259-264](packages/najm-chatbot/src/agent/ChatAgent.ts#L259-L264) falls back to `role:text` when a message has no id. A second "yes" is treated as a duplicate and removed, so the model receives a prompt that ends with its own previous answer. Separately, a web client that sends a `sessionKey` resends its whole history with client-side ids, which never match the stored `assistant-<timestamp>-<n>` ids, so each assistant message is stored twice (by reading).

**Change.**

1. In `normalizeUIMessages`, give every incoming message without an id a `crypto.randomUUID()`. Make `getMessageIdentity` return the id only.
2. Replace `mergeSessionMessages` with a rule that treats stored history as the source of truth: when stored history is not empty, append only the incoming messages that come after the last incoming assistant message and whose ids are not already stored. When stored history is empty, use the incoming list as it is.

**Known limit to document.** A client "regenerate" resends history without the last assistant message; with server memory the stored answer stays. Decide later whether to support it.

**Tests.** In `chat-memory.test.ts`: two identical id-less user messages both reach the model; a client that resends full history across three turns leaves exactly one stored copy of each message.

### C6. "Test connection" reports success without connecting (by reading)

**Problem.** `testConnection` in [AiSettingsService.ts:173-215](packages/najm-chatbot/src/ai-settings/AiSettingsService.ts#L173-L215) only constructs a client and returns `ok: true`. The form then shows "Connected".

**Change.** After building the model, make one real call: `generateText({ model, prompt: 'ping', maxOutputTokens: 1, timeout: 10_000 })`. Return `{ ok: false, error }` with the provider's message on failure; do not include the API key in any message. This costs one output token per test.

**Tests.** With a mock model: success returns `ok: true`; a throwing model returns `ok: false` with the message; the timeout is honoured.

### C7. `ollama` and `custom` call the Responses API (confirmed in the SDK source)

**Problem.** [LlmProviderFactory.ts:335-346](packages/najm-chatbot/src/agent/LlmProviderFactory.ts#L335-L346) uses `createOpenAI()(model)`, which targets `/responses`. Every other compatible provider in the file uses `.chat(model)`. Servers that only implement `/chat/completions` fail.

**Change.** Use `.chat(model)` for `ollama` and `custom`. Leave `openai` as it is. While there, normalise the Ollama base URL so a trailing `/` or an existing `/v1` does not produce `//v1` or `/v1/v1`.

**Tests.** Capture the request URL with a custom `fetch` and assert the path ends in `/chat/completions` for both providers.

### C8. `runOnce` and `debugRun` have no time limit (by reading)

**Problem.** `streamTimeout` is applied only to `streamText`. A stalled provider holds a WhatsApp turn open indefinitely.

**Change.** Pass `timeout: { totalMs, stepMs }` to both `generateText` calls, taken from `config.streamTimeout`, with a default `totalMs` of 120 000 when none is set. `chunkMs` applies to streaming only.

**Tests.** A mock model that never resolves makes `runOnce` reject within the limit and records outcome `error`.

---

## Phase 3: RAG correctness

### R1. Knowledge context cache is never invalidated (by reading)

**Problem.** [KnowledgeContextProvider.ts:26-38](packages/najm-rag/src/knowledge/KnowledgeContextProvider.ts#L26-L38) caches results by user text in a 32-entry LRU with no expiry, and `clearCache()` has no callers. A read refreshes the entry, so a frequently asked question keeps the excerpts of a document that was deleted or reindexed until the process restarts.

**Change.**

1. Give each entry a timestamp and ignore entries older than 60 s. This also bounds staleness when several instances run.
2. Call `clearCache()` after ingest, delete and reindex. `KnowledgeDocumentService` takes the provider as an optional dependency, since the provider is not always registered.

**Tests.** Ingest, ask (cached), delete the document, ask again: the second answer has no citation from the deleted document.

### R2. `rag({ knowledge: true })` without tool routing never reaches the chatbot (by reading)

**Problem.** [plugin.ts:225-227](packages/najm-rag/src/plugin.ts#L225-L227) and [plugin.ts:250-252](packages/najm-rag/src/plugin.ts#L250-L252) register `KnowledgeContextProvider` only when routing is also on, because it injects `RoutingSettingsService`. The chatbot's deprecation message recommends the knowledge-only setup.

**Change.** Make the settings dependency optional in the provider; when it is absent, treat `enableKnowledge` as `true`. Register and alias the provider whenever knowledge is enabled.

**Tests.** A server with `rag({ knowledge: true })` and `chatbot()` puts a matching excerpt into the system prompt.

### R3. Full document text travels with every search hit (by reading)

**Problem.** `ingestText` stores the whole body under `metadata.sourceText` ([DocumentIngestionService.ts:86](packages/najm-rag/src/knowledge/DocumentIngestionService.ts#L86)). `findChunksWithSource` selects source metadata once per matching chunk ([KnowledgeRepository.ts:47](packages/najm-rag/src/knowledge/KnowledgeRepository.ts#L47)), so each chat message loads the document once per hit. The document list endpoint and the `rag_studio_search_knowledge` tool return it too.

**Change.**

1. Now: in `findChunksWithSource`, select chunks without source metadata, then load the distinct sources in a second query. Remove `sourceText` from metadata in every response mapper (`KnowledgeService.search`, `KnowledgeDocumentService.listDocuments`).
2. Next: stop writing `sourceText` into metadata. Save pasted text as a stored file (`sources/<id>/original.txt`) through `StorageService`, which knowledge already requires, and read it back through `FileExtractor` on reindex. Keep the current `metadata.sourceText` read path for rows created before the change.

**Tests.** Search and list responses contain no `sourceText`; reindex works for both an old-style row and a new-style row.

### R4. Reindex deletes the old index before the new one exists (by reading)

**Problem.** `reindexDocument` in [DocumentIngestionService.ts:204-244](packages/najm-rag/src/knowledge/DocumentIngestionService.ts#L204-L244) deletes all chunks and embeddings, then embeds. If the embedding provider is down the document becomes unsearchable.

**Change.** Chunk and embed in memory first. If no chunk was embedded, leave the existing rows and set status `failed` with the error. Otherwise delete the old rows and insert the new ones, inside a transaction where the adapter provides one.

**Tests.** With an embedder that throws, reindex leaves the previous chunk and embedding counts unchanged.

### R5. Unmatched inbox stores multi-turn text, which "Map to tool" saves as a phrase (by reading)

**Problem.** The router receives the last three user turns joined by `\n---\n` and records that string as the unmatched query. `mapUnmatched` in [StudioSettingsController.ts:87-104](packages/najm-rag/src/studio/StudioSettingsController.ts#L87-L104) then creates a semantic phrase from it.

**Change.** Record the latest user message only. This uses the optional `latestUserText` argument added in T2. Clean existing rows with a one-off script that deletes unmatched entries and semantic phrases containing `\n---\n`; run it by hand after review.

**Tests.** A second-turn miss records only the second message.

---

## Phase 4: routing latency

None of these change which tools are selected.

### T1. A slow embedding provider stalls each message twice (by reading)

**Problem.** `queryTimeoutMs` defaults to 8000 and `queryFailureCooldownMs` to 0 ([EmbeddingService.ts:65-67](packages/najm-rag/src/embeddings/EmbeddingService.ts#L65-L67)). When the provider hangs, routing waits 8 s and knowledge search waits another 8 s on the same text.

**Change.** Default `queryTimeoutMs` to 4000 and `queryFailureCooldownMs` to 15 000; leave `timeoutMs` (indexing) at 8000. With a cooldown the second lookup fails at once. Record the new defaults in the CHANGELOG as a behaviour change. See decision D3 for the router-error fallback.

**Tests.** With a hanging embedder, total preparation time is about one query timeout, not two; the next message inside the cooldown does not call the provider.

### T2. One embedding request per message when a rewriter is set (by reading)

**Problem.** The router embeds the rewritten query; knowledge search embeds the original. They never share a cache entry, so each message makes two provider calls.

**Change.**

1. Add `EmbeddingService.embedQueries(texts: string[])`: look each text up in the cache, send the misses in one batch request, store the results.
2. Extend `ToolProvider.findRelevantTools` in `packages/najm-mcp/src/tokens.ts` with an optional second argument `request?: { latestUserText?: string }`. This is additive. `ChatAgent.prepare` passes it.
3. In `ToolRouterService`, when the rewritten text differs from the normalised text and knowledge is enabled, call `embedQueries([rewritten, normalised])` so the knowledge lookup that follows is a cache hit.

**Tests.** With a rewriter and knowledge on, one chat message produces one embedding HTTP request.

### T3. Miss recording delays the reply (by reading)

**Problem.** On no-match the router awaits a select and a write before returning ([ToolRouterService.ts:72-81](packages/najm-rag/src/toolRouter/ToolRouterService.ts#L72-L81)).

**Change.** Do not await `recordUnmatchedQuery`; attach a `catch` that logs. Tests that assert on the unmatched table must wait for the write (expose the pending promise for tests, or poll).

### T4. Routing and knowledge search run in sequence (by reading)

**Problem.** [ChatAgent.ts:836-879](packages/najm-chatbot/src/agent/ChatAgent.ts#L836-L879) awaits the router, then the context providers.

**Change.**

1. In `EmbeddingService.embed`, keep a map of in-flight requests by cache key so two concurrent callers share one provider call.
2. In `ChatAgent.prepare`, start context collection before awaiting the router and await both. Keep the abort checks. Update the diagnostics comment: `routingMs` and `contextMs` now overlap.

**Tests.** Existing diagnostics tests updated; a new test asserts both lookups started before either finished and that only one embedding call was made.

---

## Phase 5: routing quality

These change which tools the model receives. Do Q0 first, then measure each change.

**Baseline.** The playground database has no routing tests, semantics or interaction logs, so there is nothing to measure against today. Before Q1, import a real phrase set and a routing test set (from a production app, or write 50 to 100 cases across the four languages), run them, and record the pass rate. Re-run after each item and keep a change only if the rate does not drop.

### Q0. One routing implementation

`ToolRouterService` and `RoutingPreviewService` each implement the pipeline, and the studio's routing tests run the preview, not the router. Extract one function that returns the full decision (matches, primary, dependencies, kept and dropped tools, final list). The router returns its tool list; the preview returns the trace. After this, a routing test measures what chat uses.

### Q1. Count hits per tool, not per phrase

`topSemanticHits` limits phrase rows ([ToolRouterService.ts:53-57](packages/najm-rag/src/toolRouter/ToolRouterService.ts#L53-L57)), so a tool with many phrases can fill the list, and `selectPrimaryTool` sums the top three scores per tool ([RoutingLogic.ts:18-44](packages/najm-rag/src/toolRouter/RoutingLogic.ts#L18-L44)), which favours tools with more phrases.

Change: fetch `topSemanticHits × 5` phrase rows, aggregate per tool in JS, keep the best `topSemanticHits` tools ranked by best score, and pick the primary by best score with the mean of the top three as the tie-break.

### Q2. Search tool descriptions alongside phrases

Descriptions are searched only when no phrase clears the threshold ([ToolRouterService.ts:60-66](packages/najm-rag/src/toolRouter/ToolRouterService.ts#L60-L66)), so a tool without phrases loses to any weak phrase hit on another tool.

Change: run both searches with `Promise.all` and score each tool as the higher of its phrase score and its description score.

### Q3. Embed the latest message first

The router embeds up to three user turns joined together ([ChatAgent.ts:1026-1033](packages/najm-chatbot/src/agent/ChatAgent.ts#L1026-L1033)). That dilutes the latest intent and makes cache hits rare.

Change: embed the latest message and the joined text in one `embedQueries` call (T2). Route on the latest message; use the joined text only when the latest message matches nothing.

### Q4. Embed phrases with the query prefix

Phrases are example user queries but are embedded with purpose `document` ([SemanticPhraseService.ts:93](packages/najm-rag/src/chatbotRag/SemanticPhraseService.ts#L93) and the import paths). With empty prefixes this makes no difference. With `queryPrefix`/`documentPrefix` set, a stored phrase typed word for word no longer scores 1.0.

Change: embed phrases with purpose `query` (keep the operation label `semantic-index`). Apps that set prefixes must re-embed every phrase once; say so in the CHANGELOG. Today's "reindex semantics" cannot do that, because it only fills rows that have no vector. Use the forced reindex added in DR1.

---

## Phase 5b: Darija routing

The Darija helper is `createDarijaQueryRewriter` in [DarijaQueryRewriter.ts](packages/najm-rag/src/queryRewrites/DarijaQueryRewriter.ts). It replaces common Darija words with MSA before the routing query is embedded. Sample messages were run through it to see what the router embeds (reproduced):

| Input | Embedded text | Gap |
| --- | --- | --- |
| `شحال ديال التلاميذ كاينين فالقسم؟` | `كم التلاميذ يوجد في القسم؟` | Works as intended |
| `شحـــال ديال التلاميذ بزاااف` | `شحـــال التلاميذ بزاااف` | Tatweel and stretched letters block the lookup |
| `شكون اللي ماخلصش هاد الشهر` | `من الذي ماخلصش هذا الشهر` | `ما…ش` negation is left as is |
| `بغيت نشوف الغياب ديال ولدي` | `اريد نشوف الغياب ولدي` | Verb forms untouched |
| `ch7al dyal tlamid kaynin f l9ism` | unchanged | Latin-script Darija (Arabizi) is ignored |
| `وريني الفاتورة رقم ١٢٣` | `اعرض الفاتوره رقم ١٢٣` | `ة` becomes `ه` on the query side only |

No similarity scores were measured: no embedding server was running during the review. Every item below except DR0 and DR5 changes scores, so each one is kept only if the DR0 pass rate does not drop.

### DR0. A Darija routing test set

Routing tests already have a `lang` field. Write 50 to 100 cases with expected tools, split across three kinds of input:

- Arabic-script Darija (`lang: darija`),
- Arabizi, including digits such as `7`, `3`, `9` (`lang: darija-latn`; add it to `allowedLangs`),
- Darija mixed with French words.

Take the wording from real user messages where possible, and keep the cases out of the semantic phrase set so they stay a fair test. Record the pass rate per `lang` before any change. Add a per-language pass rate to the routing test run summary so a gain in one script cannot hide a loss in another.

### DR1. One text pipeline for phrases and queries, with a forced reindex (by reading)

**Problem.** A query is lowercased, folded (`ة→ه`, `أ→ا`, `ى→ي`) and rewritten to MSA before it is embedded ([ToolRouterService.ts:34-40](packages/najm-rag/src/toolRouter/ToolRouterService.ts#L34-L40)). A stored phrase is embedded exactly as typed ([SemanticPhraseService.ts:93](packages/najm-rag/src/chatbotRag/SemanticPhraseService.ts#L93), and lines 122, 234, 253, plus [SemanticImportJobService.ts:155](packages/najm-rag/src/chatbotRag/SemanticImportJobService.ts#L155)). With the rewriter on, a user who types a stored Darija phrase word for word is compared against a different string.

A second problem sits behind it: `reindexSemantics` only embeds rows whose vector is missing. Tool embeddings carry a fingerprint that includes the embedder settings, so a model change re-indexes them; phrases have no such protection. After a model, prefix or rewriter change, every existing phrase keeps its old vector and is compared against queries embedded the new way.

**Change.**

1. Add `canonicalizeRoutingText(text, rewrite)` to `ToolRouterUtils` (normalise, then rewrite). Use it in the router, the preview, and every phrase-embedding call site. Store and display the phrase as typed; embed the canonical form.
2. Add a `fingerprint` column to the semantics table, computed from the embedder settings (as `createFingerprint` does for tools) plus a `routingTextVersion` string in `RagConfig`. Apps bump that string when they change their rewriter, since a function cannot be hashed.
3. Make `reindexSemantics` re-embed every row whose fingerprint differs from the current one, in batches, and add a `force` option that re-embeds all rows. Report stale rows in the studio status so an operator sees that a reindex is needed.
4. Experiment, decided by DR0: keep the `ة→ه` fold only for dictionary lookup and embed the unfolded text. The fold makes query and phrase consistent after step 1, but it also moves both away from standard spelling.

**Tests.** A stored Darija phrase and the same text as a query produce the same embedded string. After changing `routingTextVersion`, reindex re-embeds all phrases; a second run re-embeds none. Changing the embedding model marks every phrase stale.

### DR2. Clean the text before the word lookup (reproduced)

**Problem.** Tatweel (`ـ`) and stretched letters stop the preset from matching. The word matcher at [DarijaQueryRewriter.ts:18](packages/najm-rag/src/queryRewrites/DarijaQueryRewriter.ts#L18) covers `ء-ي` only, so a word containing `ڭ`, `گ`, `پ` or `ڤ` is split at that letter.

**Change.**

1. In `normalizeArabic`: remove tatweel, collapse a letter repeated three or more times to one, and convert Arabic-Indic digits to ASCII. These are safe for every language.
2. In the rewriter: include `ڭ گ پ ڤ` in the word and key patterns, and treat `ڭ` and `گ` as the same letter for lookup. Do not map them to an MSA letter by rule, because the right letter varies by word; add preset entries for the common words instead (`ڭول`, `ڭاع`).

**Tests.** Extend `darija-query-rewriter.test.ts`: the stretched and tatweel forms rewrite like the plain form; a word with `ڭ` is matched whole.

### DR3. Arabizi (reproduced)

**Problem.** Latin-script Darija passes through unchanged, and `words` throws on any key that is not Arabic ([DarijaQueryRewriter.ts:69](packages/najm-rag/src/queryRewrites/DarijaQueryRewriter.ts#L69)), so an app cannot add `ch7al` itself.

**Change.**

1. Accept Latin keys (`a-z`, digits, apostrophe) in `words`, matched on whole tokens after lowercasing.
2. Ship a small Latin preset for the same function words as the Arabic one, with spelling variants: `ch7al`/`chhal`, `chno`/`chnou`/`achno`, `wach`, `fin`/`fine`, `3lach`, `kifach`, `bghit`, `dyal`/`dial`, `kayn`/`kayna`, `daba`, `lbar7`.
3. Apply the Latin preset only when the message looks like Arabizi: at least one token with a digit inside a word, or at least two preset hits. Several entries are also French or English words (`fin`, `dial`), and a French message must not be rewritten.
4. On the data side, add Arabizi example phrases per tool under `lang: darija-latn`. Queries then have same-script examples to match, which does not depend on the rewriter at all.

**Tests.** The Arabizi rows from the table rewrite their function words; a French sentence containing `fin` is unchanged. See decision D6.

### DR4. Rules for negation and common verb forms (reproduced for the gap)

**Problem.** `ماخلصش`, `نشوف`, `كنشوف` and `غنمشي` are left as they are unless an app lists each form.

**Change.**

1. Negation: a word that starts with `ما` and ends with `ش`, with a stem of at least three letters, becomes `لم` plus the stem (rewritten through the word list if it is there). Handle the spaced form `ما خلصش` the same way.
2. Present and future prefixes (`ك`, `كي`, `كت`, `كن`, `غ`, `غادي`): strip them only when what follows is a stem from a new preset verb list (`شوف`, `دير`, `مشي`, `جي`, `خلص`, `عرف`, `قدر`, and so on). A general prefix rule is not safe: it would turn `كتاب` into `تاب` and `غياب` into a future verb.
3. Add missing everyday words to the preset: `شوف`, `عافاك`, `خدام`/`خدامه`, `شي`.

**Tests.** Each rule has positive cases and a list of words that must not change, including `كتاب`, `كتب`, `غياب`, `غير` and common first names.

### DR5. Feed real misses back into the phrase set

The unmatched inbox is the best record of how users actually write, and it is only usable after R5. Then:

1. Show the canonical (rewritten) text beside each entry, and the nearest tool below the threshold, so mapping takes one click.
2. Review the inbox on a schedule and map recurring Darija misses to tools. Each mapping becomes a phrase and, if it is a new pattern, a DR0 test case.

No scoring change; this is process plus a small studio addition.

### DR6. Embedding model setup

1. The playground runs `embeddinggemma` with no `queryPrefix` or `documentPrefix`. That model's card recommends task prompts. Confirm the exact strings there, set them, reindex (DR1) and compare against DR0.
2. Benchmark two or three other multilingual models against DR0 before considering a switch. Postgres storage is fixed at 768 dimensions ([plugin.ts:127-133](packages/najm-rag/src/plugin.ts#L127-L133)), so on Postgres a candidate must produce 768 values natively or support truncation to 768.
3. A model switch re-embeds tools automatically, phrases through DR1, and knowledge documents by reindexing each one.

### DR7. Optional: translate on a miss with the LLM

**Why.** Rule-based rewriting will not cover Arabizi spelling variety. One short LLM call can.

**Change.** Add an async hook to `RagConfig`: `rewriteRoutingQueryOnMiss?: (normalized: string, options: { signal: AbortSignal }) => Promise<string | null>`. The router calls it only when nothing cleared the threshold, with a time limit of about 1500 ms, then routes once more on the returned text. Cache results in an LRU. `najm-rag` does not depend on `najm-chatbot`, so the app supplies the function; document an example that uses the configured chat model. Record in diagnostics that a second pass ran.

**Tests.** A miss calls the hook once and routes on its output; a hook that times out or throws leaves the original no-match result; a hit never calls the hook. See decision D5.

---

## Phase 6: hardening

| Id | Problem | Change |
| --- | --- | --- |
| H1 | `GET /ai-settings` returns `systemPrompt` and `baseUrl` to any signed-in user. | Return them only to administrators; other users get provider, model and enabled state. Check what the chat panel reads first. |
| H2 | `POST /chat` accepts `system` role messages and unlimited history. | Validate the body with a Zod DTO: roles `user`/`assistant` only, a cap on message count and text length. |
| H3 | Unmatched queries and interaction logs keep raw user text with no limit. | Add retention settings and a cleanup pass next to `ChatSessionCleanupService`. |
| H4 | Repositories run `ALTER TABLE`/`CREATE TABLE` on first use. | Move to documented migrations; keep the runtime check behind an opt-out flag for one release. |
| H5 | `toolsOverride`, `contextOverride` and chunk `enabled` are stored but never read. | Remove them from the DTOs and UI types, or implement them. |
| H6 | Postgres `expires_at` is a timestamp without time zone, read back with `new Date()` (unverified). | Test on a server whose time zone is not UTC; if expiry shifts, compare in SQL or append `Z` when parsing. |
| H7 | The MySQL path uses `ADD COLUMN IF NOT EXISTS` and `.returning()` (unverified). | Run the chatbot suite on MySQL, or state in the README that MySQL is not supported for sessions. |
| H8 | Vector search orders by a computed alias, so no index can serve it. | Leave for routing tables. For large knowledge bases, order by the distance operator and add an HNSW index on Postgres. Measure first. |

---

## Decisions needed

- **D1. Stored tool output cap (C1).** Suggested 4000 characters. A lower cap saves storage and prompt tokens; a higher one lets follow-up questions reuse more of the earlier result.
- **D2. Sessions with no owner (C2).** Suggested rule: a session with `userId = null` is reachable only by callers that also have no user (server-side code). The alternative, letting the first signed-in caller claim it, reopens the takeover for those rows.
- **D3. Default `fallbackOnRouterError` (T1).** Today it is `all`, which sends every tool when embeddings fail. `none` uses the existing "tools are offline" prompt instead. Suggested: keep `all` now, switch the default to `none` in the next major version.
- **D4. Query timeout and cooldown values (T1).** Suggested 4000 ms and 15 000 ms. A cold Ollama model load can exceed 4 s; if that happens in practice, raise the timeout or set Ollama's keep-alive rather than removing the cooldown.
- **D5. LLM translation on a miss (DR7).** It adds one model call and up to 1.5 s on messages that match nothing, and the README currently promises that the Darija helper adds no LLM request. Suggested: build it as an opt-in hook, off by default.
- **D6. How far to take Arabizi (DR3).** Example phrases alone (step 4) need no code and carry no risk of rewriting French. The Latin preset (steps 1 to 3) helps messages that match no example but can misfire on mixed French. Suggested: do step 4 first, measure with DR0, and add the preset only if Arabizi cases still fail.

## Verification and release

Per item: the focused test file, then the package suite.

```bash
bun run --cwd packages/najm-chatbot test
bun run test:rag
bun run test:mcp        # after T2 changes the ToolProvider type
```

Before release:

1. `bun run build`, then run the playground against built output (`bun run playground` and `bun run playground:next`).
2. By hand in the playground: a web chat with a `sessionKey` across three turns including a tool call; the same over WhatsApp; a second user posting the first user's key (expect 403); the studio assistant creating and failing to create a semantic; "Test connection" with a wrong key.
3. `bun run test` for the full sequential suite.

Packages touched: `najm-mcp` (T2, type only), `najm-rag`, `najm-chatbot`. Publish in that order, which matches `PACKAGE_TARGETS`. Phases 1 to 3 are patch releases. T1 changes defaults and Phases 5 and 5b change routing results, so release those as minor versions with CHANGELOG entries. DR1 adds a column to the semantics table in the SQLite and Postgres schemas (the MySQL schema has no semantics table); ship a migration note, and tell apps to run the forced semantic reindex after upgrading.
