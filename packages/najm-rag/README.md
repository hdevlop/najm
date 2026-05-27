# najm-rag

RAG (Retrieval-Augmented Generation) engine for the Najm framework. Provides semantic tool routing, document ingestion, embeddings, vector search, and a hosted RAG Studio admin UI.

## Installation

```bash
bun add najm-rag
```

## Core Concepts

**Tool Routing:** When your app has many MCP tools, sending all of them on every request burns tokens. RAG selects the relevant subset per query using semantic embeddings.

**Knowledge RAG:** Upload PDFs, plain text, and markdown documents. Chunks are embedded and stored in a vector database for retrieval-augmented chat.

**RAG Studio:** A hosted admin UI served on the same port (`/rag-studio`) for live tuning of routing settings, semantic phrases, document management, and routing tests — no redeploy needed.

## Quick Start

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

```typescript
server
  .use(mcp({ path: '/mcp' }))
  .use(rag({
    dialect: 'sqlite',
    toolRouting: { enabled: true },
    studio: {
      enabled: true,
      access: 'token',   // requires RAG_STUDIO_TOKEN env var (>= 32 chars)
    },
  }))
  .use(chatbot());

// Open http://localhost:3000/rag-studio
```

### Knowledge RAG

```typescript
server
  .use(storage({ provider: 'local', basePath: 'storage' }))  // required for document uploads
  .use(rag({
    dialect: 'sqlite',
    knowledge: true,    // enable document ingestion + search
    studio: { enabled: true, access: 'token' },
  }))
  .use(chatbot());
```

## Plugin Configuration

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

### `studio`

```typescript
rag({
  studio: {
    enabled: true,       // serve RAG Studio UI (default: false)
    path: '/rag-studio',   // mount path (default: '/rag-studio')
    access: 'token',      // 'none' | 'token' | 'admin' | 'custom'
    tokenEnvVar: 'RAG_STUDIO_TOKEN',  // env var name for token access
    customGuard: async (req) => true,  // only for access: 'custom'
  },
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

## Studio Access Modes

| Mode | Auth method | Production safe? |
|------|-------------|-----------------|
| `'token'` | Bearer token via `Authorization` header or `?token=` query param | Yes — requires `RAG_STUDIO_TOKEN` env var (>= 32 chars) |
| `'admin'` | Uses `najm-auth` admin guard (`@isAdministrator()` on all routes) | Yes |
| `'custom'` | Provide your own guard via `studio.customGuard` | Yes |
| `'none'` | Loopback only (127.0.0.1/localhost) | **No** — only for local development |

The Studio is **disabled by default**. It only runs when `studio.enabled === true`. All write operations are audited in the `chatbot_studio_audit_logs` table.

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

### RAG Studio API (`/rag-studio/api`) — access controlled

All routes under `/rag-studio/api/*` are protected by the studio access mode. Knowledge operations require `knowledge: true` in the config.

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
                RagToolRoutingConfig, RagKnowledgeConfig, RagSchema,
                RagStudioConfig, StudioAccess } from 'najm-rag';

// Token providers (used by najm-chatbot)
export { RAG_TOOL_PROVIDER } from 'najm-rag';
export type { RagToolProvider } from 'najm-rag';

// Services
export { ChatbotRagService, ChatbotRagController, ChatbotRagValidator } from 'najm-rag';
export { EmbeddingService, ToolIndexRepository, ToolIndexerService, ToolRouterService } from 'najm-rag';
export { RoutingSettingsService, RoutingSettingsRepository } from 'najm-rag';
export { KnowledgeService, KnowledgeRepository, DocumentSourceRepository,
         DocumentIngestionService, PdfExtractor, TextChunker, MarkdownChunker } from 'najm-rag';
export { StudioService } from 'najm-rag';

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
│   ├── studio/          # RAG Studio service + routes
│   │   ├── StudioService.ts        # access control + API routing + audit
│   │   └── StudioController.ts    # decorator-based routes (unused)
│   ├── schema/          # Drizzle table definitions per dialect
│   │   ├── sqlite.ts    # includes chatbot_studio_audit_logs
│   │   ├── pg.ts
│   │   └── mysql.ts
│   ├── config.ts         # RagConfig, RagMergedConfig types
│   ├── tokens.ts        # DI token symbols
│   ├── provider.ts       # RAG_TOOL_PROVIDER interface
│   └── plugin.ts         # rag() factory
└── studio/               # React SPA (Vite build → dist/studio/)
    ├── src/
    │   ├── components/
    │   │   ├── layout/      # AppShell, Sidebar, InspectorPanel
    │   │   ├── chat/         # ChatArea, MessageList, CitationBadge
    │   │   ├── knowledge/    # DocumentList, ChunkTable, UploadDialog
    │   │   ├── routing/      # ToolList, SemanticsEditor, RoutingLab
    │   │   ├── settings/    # SettingsPanel, IndexSettings, AccessSettings
    │   │   └── ui/           # shadcn/ui components
    │   ├── hooks/      # useApi, useWorkspace
    │   ├── lib/        # api.ts (token acquisition + fetch wrapper)
    │   └── types/      # studio.ts (TypeScript interfaces)
    └── vite.config.ts  # dev proxy → :3000, output → dist/studio
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
| `najm-auth` | `studio.access === 'admin'` (admin guard on all studio routes) |
