# najm-rag

RAG (Retrieval-Augmented Generation) engine for the Najm framework. Provides semantic tool routing, document ingestion, embeddings, vector search, and the RAG Studio admin UI (`najm-rag/studio`).

## Installation

```bash
bun add najm-rag
```

## Core Concepts

**Tool Routing:** When your app has many MCP tools, sending all of them on every request burns tokens. RAG selects the relevant subset per query using semantic embeddings.

**Knowledge RAG:** Upload PDFs, plain text, and markdown documents. Chunks are embedded and stored in a vector database for retrieval-augmented chat.

**RAG Studio:** An admin UI for live tuning of routing settings, semantic phrases, documents, and routing tests — no redeploy needed. `ragStudio()` serves its admin API; you mount `<RagStudio />` from `najm-rag/studio` as a page in your own app, on the same origin, so it reuses the signed-in admin session. It is optional: `rag()` works without it.

## Quick Start

### Request-scoped embedding diagnostics

```typescript
import { withEmbeddingDiagnostics } from 'najm-rag';

const embeddings = [];
const result = await withEmbeddingDiagnostics({
  correlationId: requestId,
  onEmbedding: event => { embeddings.push(event); },
}, () => runRequest());
```

The scope captures nested async calls to `EmbeddingService` without sharing a
current-request variable. Events contain counts and timings, operation/purpose,
cache status, provider/model and outcome; they omit input text, vectors,
endpoints, credentials and raw error messages. Offsets are relative to scope
start. `attempts` records each actual HTTP request, including batch requests and
health retries. A cache hit or cooldown skip has no attempts. `embed` emits one
logical call rather than duplicating its internal batch. Empty knowledge indexes
make no embedding call and therefore emit no event.

`onEmbedding` is best effort and runs when each logical call finishes. Throws
and rejected promises are ignored; async sinks are not awaited. Prefer a
synchronous collector or queue. Capture ends when the scope's callback settles;
await work that must be included. Nested scopes isolate their events and restore
their parent. Do not sum logical-call durations with their nested attempt durations
or with routing/context spans.

The plugin registers `RAG_DIAGNOSTICS` as a `RagDiagnosticsRunner` when embeddings
are enabled. Optional consumers can resolve this DI bridge without importing a
mandatory RAG runtime dependency. `najm-chatbot` uses it to include embedding
spans in its existing diagnostics. Apps outside chat can use the function above.
`EmbeddingService.clearQueryCache()` clears only that instance's vector cache;
it does not reset cooldown, the embedding model, routing settings or application
caches. This is one measurement control, not a complete cold-cache reset.

### Optional Darija wording support

Use the exported vocabulary helper with the existing routing rewrite hook:

```typescript
import { rag, createDarijaQueryRewriter } from 'najm-rag';

rag({
  toolRouting: { enabled: true },
  rewriteRoutingQuery: createDarijaQueryRewriter({
    words: { ماخلصوش: 'لم يدفعوا' }, // this app's payment vocabulary
    rewriteRules: [{ from: 'الرقم ديال', to: 'معرف الطلب' }],
  }),
});
```

The pure helper and its types also ship at `najm-rag/query-rewrites`.
It converts common Moroccan Darija wording to MSA before tool routing and its
preview embed a question. It is opt-in and leaves the original chat message,
knowledge search and tool permissions unchanged. It is a vocabulary preset,
not a complete translator or a promise that every embedding model routes better.

`words` extends/overrides the preset; `null` disables a preset entry. Keys are
normalized Arabic words and meaningful shadda is preserved. `rewriteRules` are
literal Arabic word sequences matched against the message as typed (after the
cleanup below, before anything else), applied in order before the built-in
count rule; vowel marks and attached conjunctions are supported.
Apps own domain meanings such as attendance, grades, payments and what “the
number” refers to. Unknown words and names remain unchanged unless they match
a configured rule; keep ambiguous/name-like terms out of the shared preset.

Before the word list, the rewriter removes tatweel (`ـ`), collapses a letter
stretched three or more times, turns Arabic-Indic digits into `0-9`, rewrites a
joined negation (`ماعرفتش` → `لم عرفت`, unless the word list has the word) and
strips present/future prefixes and the first-person `ن` before known verbs
(`كنقلب` → `قلب`, `نزيد` → `زيد`) and an object pronoun attached to an
imperative (`زيدلي`, `حطها`). These apply only to a fixed list of verbs, so
words such as `كتاب`, `غياب` and `نسيم` stay as they are.

The preset holds everyday verbs (`حيد`, `زيد`, `مسح`, `خوي`, `بدل`, ...),
quantities and courtesy words. Add your app's nouns and payment words through
`words`; for a shop, for example:

```typescript
createDarijaQueryRewriter({
  words: { البانيي: 'السله', الكوموند: 'الطلب', الكونط: 'الحساب', المنتوج: 'المنتج', خلص: 'ادفع' },
})
```

Existing **semantic phrases** remain example questions attached to tools. They
are embedded through the same rewrite as messages, so a phrase typed as a
question matches it. No LLM request is added. When enabling or changing the
preset, re-run held-out routing cases (`routing-benchmark.ts --darija`) and
check both phrase and description matches.

`words` also accepts Latin-script (Arabizi) keys such as `ch7al` or `bghit`,
matched as whole tokens, digits included. None are preset, because many
Arabizi spellings are also French or English words (`fin`, `dial`); add the
ones your users write. Adding Arabizi example phrases to tools (for example
under `lang: 'darija-latn'`) helps without any rewriting.

When you change the rewriter, also change `routingTextVersion` (any string).
Phrases record which embedder setup produced their vectors, and "reindex
semantics" re-embeds the ones that no longer match.

#### Second chance for a miss

`rewriteRoutingQueryOnMiss` runs only when a message matched no tool. It can
call an LLM to translate the message; routing then runs once more on the result.
It gets 1.5 s and an abort signal, results are cached per message, and a
failure keeps the no-match outcome. It is off unless set, and it adds a model
call to every unmatched message.

The model must translate Darija reliably and answer within the limit. On the
routing benchmark, a local `qwen2.5:1.5b` made routing worse: it mistranslated
most Darija and Arabizi, answered greetings instead of translating them (so
small talk matched tools), and took over 1.5 s for a third of the calls. Small
talk reaches this hook too, so tell the model to translate and never answer,
and measure with `routing-benchmark.ts --dr7 --llm <model>` before enabling it.

```typescript
rag({
  toolRouting: { enabled: true },
  rewriteRoutingQueryOnMiss: async (message, { signal }) => {
    const { text } = await generateText({ model, abortSignal: signal, prompt: `Rewrite in Modern Standard Arabic: ${message}` });
    return text;
  },
});
```

#### Unmatched queries

A message that matched no tool is recorded in the studio's unmatched inbox (the
user's latest message only), without delaying the reply. Each entry shows the
closest tool below the threshold, which "Map" starts on, and, with a
`rewriteRoutingQuery`, the text routing embeds after the rewrite. Entries stay until
they are mapped or discarded; `unmatchedRetentionDays: 30` deletes entries not
seen for 30 days, hourly. They hold users' messages, so set a limit that fits
your privacy policy. Rows written before this release may hold several turns
joined by `---`; the najm repository's `packages/najm-rag/scripts/cleanup-multiturn-routing-rows.ts <db>` (not published to npm)
lists them, and `--apply` deletes them.

#### Shipping phrases with the app

`seedSemantics` takes phrases in the studio's "Import JSON" format, so every
database gets them without a manual import:

```ts
import semantics from './semantics.json'; // { items: [{ toolName, phrases: [{ phrase, lang }] }] }

rag({ toolRouting: { enabled: true }, seedSemantics: semantics });
```

After boot tool indexing, phrases not yet stored (same tool, phrase and
language) are added with source `seed`. Stored phrases are not touched or
re-embedded, so a restart costs nothing and studio edits stay. A seed phrase
deleted or reworded in the studio comes back on the next boot while it is in
the file: change it in the file to change it for good. Phrases for tools that
are not registered are skipped with one warning. Nothing runs with
`indexOnBoot: false` or while the embedding provider is unreachable (the next
boot retries).

### Tool Routing

```typescript
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { mcp } from 'najm-mcp';
import { rag } from 'najm-rag';
import { chatbot } from 'najm-chatbot';

const server = new Server()
  .use(database({ default: db }))
  .use(mcp({ path: '/mcp' }))
  .use(rag({
    dialect: 'sqlite',
    toolRouting: { enabled: true },
  }))
  .use(chatbot());   // consumes the RAG tool provider automatically

await server.listen(3000);
```

### With RAG Studio

Server: register the admin API. It needs `rag`, `auth`, and `database`; every
route is `@isAdmin()` gated.

```typescript
import { rag, ragStudio } from 'najm-rag';

server
  .use(auth({ ... }))
  .use(database({ default: db }))
  .use(rag({ dialect: 'sqlite', toolRouting: { enabled: true } }))
  .use(ragStudio());   // admin API at /rag-studio
```

Client: mount the UI on one page of your app (React; `'use client'` in Next).
It renders after hydration, so no `ssr: false` is needed.

```tsx
// app/rag-studio/[[...slug]]/page.tsx (Next.js) — or any React route
'use client';
import { RagStudioProvider, RagStudio } from 'najm-rag/studio';
import 'najm-rag/studio/styles.css';

export default function RagStudioPage() {
  return (
    <RagStudioProvider apiBase="/api/rag-studio" basePath="/rag-studio">
      <div style={{ height: '100dvh' }}>
        <RagStudio />
      </div>
    </RagStudioProvider>
  );
}
```

Protect the page route for admins in your app as well (the API already is), so
signed-out visitors are sent to your login page instead of seeing API errors.

Optional extras:

- `ragStudio({ assistant: true })` adds the Studio Assistant. It requires
  `studioAssistant()` from `najm-chatbot`.
- `chatSettingsPanel={AiSettingsPanel}` (from `najm-chatbot/react`) on the
  provider enables the chatbot settings sheet in Chat Debug.
- `auth="standalone"` on the provider shows the studio's own login screen and
  uses a Bearer token, for hosts without a session-based login.

### Knowledge RAG

```typescript
import { isAuth } from 'najm-auth';
import { storage } from 'najm-storage';

server
  .use(storage({ provider: 'local', basePath: 'storage', guards: [isAuth()] }))  // required for document uploads
  .use(rag({
    dialect: 'sqlite',
    knowledge: true,    // enable document ingestion + search
  }))
  .use(chatbot());
```

## Plugin Configuration

### Embedding providers

Ollama remains the default. For llama.cpp, LM Studio, or an authenticated
OpenAI-compatible service, configure its API base URL (including `/v1`):

```typescript
rag({
  embedding: {
    provider: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:18080/v1',
    model: 'embeddinggemma',
    dimensions: 768,
    batchSize: 4,
    timeoutMs: 8000,
    // apiKey: process.env.RAG_EMBEDDING_API_KEY,
    queryPrefix: 'task: search result | query: ',
    documentPrefix: 'title: none | text: ',
  },
  toolRouting: { enabled: true },
});
```

Prefixes are model-specific. With an EmbeddingGemma model (the default) and
neither prefix set, the retrieval prompts above are used and the routing threshold
defaults to 0.35; the prompts lower every score. Set either prefix, even to `''`,
to use your own prompts; the threshold then defaults to 0.45, as for every other
model, whose prefixes are empty. `embed(text)` embeds a query; `embed(text, 'document')` and
`embedBatch(texts)` embed indexed content. `embedBatch(texts, 'query')` is also
available. Batches are sequential and default to 16 inputs per request. Each batch
has its own timeout; callers may impose an overall indexing deadline separately.

Queries and indexing can wait differently. A CPU embedding model may need many
seconds for a batch of long documents but a fraction of a second for a chat
message, so queries have their own `queryTimeoutMs` (default: 4000, or `timeoutMs`
when that is shorter). With `queryFailureCooldownMs` (default: 15000), a query that
times out or cannot connect makes the following queries fail at once for that long,
so one message's routing and knowledge search do not each wait out the timeout
during an outage; a success or a healthy health check ends the window. Set it to 0
to try the provider on every query. Indexing is never skipped. A cold local model
can take longer than 4 s to answer its first query; raise `queryTimeoutMs` or keep
the model loaded (Ollama's `keep_alive`) rather than turning the cooldown off.

```typescript
embedding: { timeoutMs: 60_000, queryTimeoutMs: 5_000, queryFailureCooldownMs: 30_000 }
```

Knowledge search skips the embedding call while no document is indexed. When it
fails, the chat context carries `KNOWLEDGE_UNAVAILABLE_CONTEXT`, which tells the
model the knowledge base could not be searched, and the chat continues.

The compatible provider sends float-encoded embeddings requests, validates and
reorders response indexes, and rejects missing, nonfinite or incorrectly sized
vectors. Health probes use the same authenticated request and validation. API keys
belong in server environment/configuration, never a routing JSON file. Redirects
are refused. Local services do not require an API key.

Some local servers ignore the request's `dimensions` field. For a model that
supports Matryoshka dimensions, set `truncateDimensions: true` to shorten a
longer returned vector to the configured dimension and normalize it. This is
opt-in; shorter vectors, zero-length shortened vectors, and nonfinite values
still fail validation. Qwen3 Embedding 0.6B returns 1024 values through
llama.cpp even when asked for 768, and supports shortening to 768. Model-specific
query instructions still belong in `queryPrefix`.

Bundled vector schemas remain fixed at 768 dimensions; setting `dimensions` does
not migrate storage. Use a compatible model/output dimension. Matching dimensions
alone do not imply compatible vector spaces. After a change of model, dimensions,
truncation or document prefix, tools are re-embedded on the next indexing run and
phrases are reported stale until "reindex semantics" runs; knowledge documents
must be reindexed one by one. Quantization is not detected: reindex after changing
it.

Run a local server with a pinned llama.cpp build and a verified model file:

```sh
llama-server -m embeddinggemma-300M-Q8_0.gguf --embeddings --alias embeddinggemma --host 127.0.0.1 --port 18080 --threads 2 --threads-batch 2 --parallel 1 --ctx-size 2048 --batch-size 2048 --ubatch-size 2048 --n-gpu-layers 0
```

Test your hardware and indexing batches before increasing concurrency. For
containers, use a private service address reachable by the application container;
its `127.0.0.1` refers to that container, not the host or a sibling container.

### `toolRouting`

```typescript
rag({
  toolRouting: {
    enabled: true,              // enable RAG-powered tool selection
    maxTools: 12,               // max tools sent to LLM per turn (default: 12)
    topSemanticHits: 8,         // tools matched before dependencies (default: 8)
    similarityThreshold: 0.35, // cosine floor (default: 0.35 with EmbeddingGemma prompts, else 0.45)
    fallbackOnRouterError: 'all',  // 'all' | 'none' when embedding fails
    fallbackOnNoMatch: 'none',     // 'all' | 'none' when no tools score above threshold
    dependencies: {},             // tool -> dependent tools mapping
    dangerousIntentKeywords: {},   // group -> keywords mapping (gated tools)
  },
})
```

How a tool is picked for a message:

1. The user's latest message is routed on its own. Only when it matches nothing
   are the last turns routed together, so a bare "yes" still follows the
   question it answers. A miss is recorded with the latest message.
2. Example phrases and tool descriptions are searched together. Each tool scores
   the better of its best phrase and its description, so a tool without phrases
   still competes, and a tool with many phrases cannot fill the list.
3. Tools at or above `similarityThreshold` are kept, best first, up to
   `topSemanticHits`; the best one is the primary. Dependencies join, and write
   tools other than the primary and its dependencies are dropped.

Phrases are stored as typed and embedded as routing embeds a message:
lowercased, with Arabic letter variants folded and `rewriteRoutingQuery`
applied. Phrases saved by earlier releases are re-embedded by "reindex
semantics".

To measure a change on your own data, the najm repository has
`packages/najm-rag/scripts/routing-benchmark.ts` (not published to npm). It runs
a case file through this router against a live Ollama model and reports the
right-primary rate per language and the share of small talk given tools.

### `ragStudio()`

```typescript
ragStudio({
  assistant: false,     // register the Studio Assistant (needs najm-chatbot's studioAssistant())
  auth: 'session',      // 'session' (host cookies) | 'standalone' (Bearer login in the UI)
})
```

### `knowledge`

```typescript
rag({
  knowledge: true,   // or { enabled: true, namespace: 'rag', basePath: 'storage' }
})
```

### `embedding`

```typescript
rag({
  embedding: {
    provider: 'ollama',   // currently only 'ollama' (pluggable interface exists)
    baseUrl: 'http://localhost:11434',
    model: 'embeddinggemma',  // 768-dim embedding model
    dimensions: 768,
  },
})
```

### JSON config file (legacy)

```typescript
rag({
  configPath: './src/server/config/chatbot/routing.json',   // legacy compatibility
  toolRouting: { enabled: true },
})
```

The JSON file format is deprecated — use the TypeScript plugin options above. The JSON loader exists for backward compatibility with existing `routing.json` files.

## Studio Access

RAG Studio is off unless you register `ragStudio()`. Every studio API route
uses `najm-auth`'s `@isAdmin()` guard (role `admin`). All write operations are
audited in the `chatbot_studio_audit_logs` table.

## Schema

Spread the RAG schema into your Drizzle schema:

```typescript
import { ragSchema } from 'najm-rag/sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const db = drizzle(sqlite, {
  schema: {
    ...ragSchema,   // all RAG tables
    // your tables...
  },
});
```

### Dialect entrypoints

```typescript
import { ragSchema } from 'najm-rag/sqlite';  // SQLite (uses sqlite-vec for vectors)
import { ragSchema } from 'najm-rag/pg';      // PostgreSQL (uses pgvector)
import { ragSchema } from 'najm-rag/mysql';   // MySQL: table definitions only
```

**MySQL is not supported at runtime.** `najm-rag/mysql` only defines the tables,
for apps that keep one Drizzle schema across dialects. Tool routing refuses to
start on MySQL, knowledge search has no MySQL vector search, and no part of the
plugin has been tested on a MySQL server. Use PostgreSQL or SQLite.

### Migrations

The exported schema (`najm-rag/sqlite`, `najm-rag/pg`) holds every table,
column and index the plugin uses; a test checks this against the runtime code
on both dialects. Spread `ragSchema` into your Drizzle schema and generate
migrations with drizzle-kit as you do for your own tables. On PostgreSQL, run
`CREATE EXTENSION IF NOT EXISTS vector;` before the first migration.

Until your migrations own these tables, the repositories add a missing column
or table the first time they need it, which needs a database user allowed to
alter tables. Once they do, turn that off:

```typescript
rag({ ensureSchema: false, toolRouting: { enabled: true } });
```

With `ensureSchema: false` the plugin never runs `CREATE` or `ALTER`; a missing
column then fails the query that needs it. The runtime step will be removed in
a later major release.

This release adds two nullable text columns: `chatbot_tool_semantics.fingerprint`
and `chatbot_unmatched_queries.nearest_tool`.

### Tables included in `ragSchema`

| Table | Description |
|-------|-------------|
| `chatbot_tool_embeddings` | Tool name, description, fingerprint, and vector embedding |
| `chatbot_tool_semantics` | Multilingual semantic phrases mapped to tools |
| `chatbot_routing_settings` | Runtime routing configuration (live-editable) |
| `chatbot_document_sources` | Uploaded document metadata (PDF, text, markdown, image) |
| `chatbot_document_chunks` | Chunked document text with page numbers |
| `chatbot_document_embeddings` | Document chunk vectors |
| `chatbot_studio_audit_logs` | RAG Studio write operation audit trail |

## CLI Commands (najm-cli)

### `najm-cli rag:init`

Scaffolds `routing.json`, `semantics.json`, and `routing-test-cases.json` in `src/server/config/chatbot/`. Idempotent — preserves user edits.

### `najm-cli rag:scan`

Boots the app via `Server.init()`, reads the MCP registry, and writes semantic phrases to `semantics.json`. Use `--dry-run` to preview, `--prune` to remove orphaned entries.

Your entrypoint must export an unlistened `Server`:

```typescript
// src/server/index.ts
export const server = new Server().use(...).load(...);

// src/server/main.ts
import { server } from './index';
await server.listen(3000);
```

### `najm-cli rag:scan --target db`

Imports `semantics.json` directly into the database (`chatbot_tool_semantics` table) using the app's DI container, bypassing HTTP.

## Auto-Registered Routes

### Tool Routing (`/chatbot-rag`) — requires `@isAdministrator()`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/chatbot-rag/status` | Dialect, embedding model, indexed/semantic counts |
| `POST` | `/chatbot-rag/index-tools` | Trigger tool reindex |
| `GET` | `/chatbot-rag/semantics` | List semantic phrases |
| `POST` | `/chatbot-rag/semantics` | Create semantic phrase (auto-embeds) |
| `PATCH` | `/chatbot-rag/semantics/:id` | Update phrase (re-embeds if changed) |
| `DELETE` | `/chatbot-rag/semantics/:id` | Delete phrase + vector |
| `POST` | `/chatbot-rag/semantics/reindex` | Re-embed phrases with no vector or one from a different embedder setup; `?force=true` re-embeds all |
| `POST` | `/chatbot-rag/semantics/import` | Batch import from JSON |
| `GET` | `/chatbot-rag/semantics/export` | Export to JSON |
| `POST` | `/chatbot-rag/routing/preview` | Test a query against the router |
| `GET` | `/chatbot-rag/settings` | Get effective routing settings |
| `PATCH` | `/chatbot-rag/settings` | Update live routing settings |

### Knowledge RAG (`/chatbot-rag/knowledge`) — requires `@isAdministrator()`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/chatbot-rag/knowledge/status` | Document/chunk/embedding counts |
| `POST` | `/chatbot-rag/knowledge/search` | Search document chunks by query |
| `GET` | `/chatbot-rag/knowledge/documents` | List document sources |
| `POST` | `/chatbot-rag/knowledge/documents/upload` | Upload PDF, txt, md (multipart) |
| `POST` | `/chatbot-rag/knowledge/documents/text` | Ingest raw text/markdown body |
| `GET` | `/chatbot-rag/knowledge/documents/:id/chunks` | List chunks for a document |
| `DELETE` | `/chatbot-rag/knowledge/documents/:id` | Delete document + chunks + embeddings |
| `POST` | `/chatbot-rag/knowledge/documents/:id/reindex` | Re-chunk and re-embed a document |

### RAG Studio API (`/rag-studio`) — requires `@isAdmin()`

Registered by `ragStudio()`. Knowledge operations require `knowledge: true` in the `rag()` config.

## Hot-Reload Behavior

The following settings are **live-editable** without restart:

- `maxTools`, `topSemanticHits`, `similarityThreshold`
- `fallbackOnRouterError`, `fallbackOnNoMatch`
- `dependencies`, `dangerousIntentKeywords`
- Semantic phrases (embedded on save via Studio or API)

The following settings are **boot-only** (require restart):

- `embedding.provider`, `embedding.model`, `embedding.dimensions`
- Vector store driver (`dialect`)
- `knowledge.enabled`

## Exported API

```typescript
// Plugin
export { rag } from 'najm-rag';
export type { RagConfig, RagMergedConfig, RagDialect, RagEmbeddingConfig,
                RagToolRoutingConfig, RagKnowledgeConfig, RagSchema } from 'najm-rag';
export { ragStudio } from 'najm-rag';
export type { RagStudioOptions } from 'najm-rag';

// Studio UI (React)
export { RagStudioProvider, RagStudio, useStudioAuth } from 'najm-rag/studio';
import 'najm-rag/studio/styles.css';

// Token providers (used by najm-chatbot)
export { RAG_TOOL_PROVIDER } from 'najm-rag';
export type { RagToolProvider } from 'najm-rag';

// Services
export { ChatbotRagService, ChatbotRagController, ChatbotRagValidator } from 'najm-rag';
export { EmbeddingService, ToolIndexRepository, ToolIndexerService, ToolRouterService } from 'najm-rag';
export { RoutingSettingsService, RoutingSettingsRepository } from 'najm-rag';
export { KnowledgeService, KnowledgeRepository, DocumentSourceRepository,
         DocumentIngestionService, PdfExtractor, TextChunker, MarkdownChunker } from 'najm-rag';

// Schema
export { ragSchema } from 'najm-rag/sqlite';
export { ragSchema } from 'najm-rag/pg';
export { ragSchema } from 'najm-rag/mysql';

// Legacy compatibility (deprecated)
export { chatbotSchema } from 'najm-chatbot/sqlite';   // re-exports from najm-rag
```

## Architecture

```
najm-rag/
├── src/
│   ├── chatbotRag/     # Tool routing service + controller
│   │   ├── ChatbotRagService.ts    # Semantic CRUD + routing
│   │   ├── ChatbotRagController.ts  # HTTP endpoints
│   │   └── ChatbotRagValidator.ts
│   ├── embeddings/     # Ollama embedding provider
│   │   └── EmbeddingService.ts
│   ├── vectorStore/    # pgvector + sqlite-vec strategies
│   │   ├── PgVectorStrategy.ts
│   │   └── SqliteVecStrategy.ts
│   ├── toolIndex/      # Tool fingerprinting + indexing
│   │   ├── ToolIndexRepository.ts
│   │   └── ToolIndexerService.ts
│   ├── toolRouter/     # Semantic routing engine
│   │   ├── ToolRouterService.ts    # findRelevantTools + previewRouting
│   │   └── ToolRouterDto.ts
│   ├── routingSettings/  # DB-backed runtime settings
│   │   ├── RoutingSettingsService.ts
│   │   └── RoutingSettingsRepository.ts
│   ├── knowledge/       # Document ingestion + chunking + search
│   │   ├── KnowledgeService.ts     # search(query) → citations
│   │   ├── KnowledgeRepository.ts # chunk search + join
│   │   ├── DocumentSourceRepository.ts
│   │   ├── DocumentIngestionService.ts
│   │   ├── TextChunker.ts         # paragraph/token budget split
│   │   ├── MarkdownChunker.ts
│   │   └── PdfExtractor.ts         # pdf-parse wrapper
│   ├── studio/          # ragStudio() plugin + admin API controllers
│   ├── studio-ui/       # RAG Studio React UI → dist/studio (najm-rag/studio)
│   ├── schema/          # Drizzle table definitions per dialect
│   │   ├── sqlite.ts    # includes chatbot_studio_audit_logs
│   │   ├── pg.ts
│   │   └── mysql.ts
│   ├── config.ts         # RagConfig, RagMergedConfig types
│   ├── tokens.ts        # DI token symbols
│   ├── provider.ts       # RAG_TOOL_PROVIDER interface
│   └── plugin.ts         # rag() factory
```

## Provider Contract

`najm-rag` registers `ToolRouterService` under the neutral `TOOL_PROVIDER` symbol (owned by `najm-mcp`). `najm-chatbot`'s `ChatAgent` resolves this token at runtime, so `najm-chatbot` has **no direct dependency** on `najm-rag`. This means:

- `chatbot()` works without RAG (no tools registered → plain chat)
- `rag({ toolRouting: { enabled: true } })` registers the tool provider automatically
- A future consumer (e.g. a non-chat AI app) could also use `najm-rag` for routing without `najm-chatbot`

## Dependencies

| Dependency | When required |
|------------|----------------|
| `najm-mcp` | `toolRouting.enabled === true` (tool index uses MCP registry) |
| `najm-storage` | `knowledge.enabled === true` (document file storage) |
| `najm-auth` | `ragStudio()` (admin guard on all studio routes) |
| `react`, `react-dom` | `najm-rag/studio` UI only (optional peers) |
