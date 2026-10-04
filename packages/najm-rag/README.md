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
literal Arabic word sequences, applied in order before the built-in count rule
and word substitutions; vowel marks and attached conjunctions are supported.
Apps own domain meanings such as attendance, grades, payments and what “the
number” refers to. Unknown words and names remain unchanged unless they match
a configured rule; keep ambiguous/name-like terms out of the shared preset.

Existing **semantic phrases** remain example questions attached to tools.
`rewriteRules` transform query text before that semantic matching. When enabling
or changing the preset, re-run held-out routing cases and check both phrase and
description matches. Rewritten queries may match previously indexed Darija
examples differently; tune those examples separately. No LLM request is added.

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

Prefixes are model-specific and empty by default. The example uses EmbeddingGemma's
retrieval prompts. `embed(text)` embeds a query; `embed(text, 'document')` and
`embedBatch(texts)` embed indexed content. `embedBatch(texts, 'query')` is also
available. Batches are sequential and default to 16 inputs per request. Each batch
has its own timeout; callers may impose an overall indexing deadline separately.

Queries and indexing can wait differently. A CPU embedding model may need many
seconds for a batch of long documents but a fraction of a second for a chat
message, so give queries a shorter `queryTimeoutMs` (default: `timeoutMs`). With
`queryFailureCooldownMs`, a query that times out or cannot connect makes the
following queries fail at once for that long, so one message's routing and
knowledge search do not each wait out the timeout during an outage; a success
or a healthy health check ends the window. Indexing is never skipped.

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
not migrate storage. Use a compatible model/output dimension. When changing model,
quantization or prefixes, rebuild all affected indexes before serving queries;
matching dimensions alone do not imply compatible vector spaces. Existing tool
fingerprints do not automatically trigger rebuilding for embedding configuration
changes. Start with an empty index or use an explicit reviewed reindex procedure.

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
    topSemanticHits: 8,         // phrase matches to consider (default: 8)
    similarityThreshold: 0.45, // cosine similarity floor (default: 0.45)
    fallbackOnRouterError: 'all',  // 'all' | 'none' when embedding fails
    fallbackOnNoMatch: 'none',     // 'all' | 'none' when no tools score above threshold
    dependencies: {},             // tool -> dependent tools mapping
    dangerousIntentKeywords: {},   // group -> keywords mapping (gated tools)
  },
})
```

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
import { ragSchema } from 'najm-rag/mysql';   // MySQL (no vector operations)
```

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
| `POST` | `/chatbot-rag/semantics/reindex` | Re-embed all unembedded phrases |
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
