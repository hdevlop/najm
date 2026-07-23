# najm-chatbot

Chatbot plugin for the Najm framework — AI settings management, multi-provider LLM factory, MCP tool integration, conversation sessions, a React UI, and test utilities.

## Installation

```bash
bun add najm-chatbot
```

### Peer Dependencies

This plugin requires the following Najm plugins to be registered on the server:

- `najm-auth` — authentication and encryption
- `najm-database` — database connection

It also depends on `najm-event` (auto-registered), `najm-cache`, and `najm-guard`.

```bash
bun add najm-auth najm-database drizzle-orm zod reflect-metadata
```

## Quick Start

```typescript
import { Server } from 'najm-core';
import { database } from 'najm-database';
import { auth } from 'najm-auth';
import { chatbot } from 'najm-chatbot';
import { chatbotSchema } from 'najm-chatbot/sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database('./app.db');
const db = drizzle(sqlite, { schema: { ...chatbotSchema } });

const server = new Server()
  .use(database({ default: db }))
  .use(auth({
    dialect: 'sqlite',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
    },
  }))
  .use(chatbot({
    dialect: 'sqlite',
    defaultSystemPrompt: 'You are a helpful assistant.',
  }));

await server.listen(3000);
```

## Plugin Configuration

```typescript
import { chatbot } from 'najm-chatbot';

chatbot({
  dialect: 'sqlite',               // 'sqlite' | 'pg' | 'mysql'
  schema: myCustomSchema,          // Override schema object

  // Agent behavior
  defaultSystemPrompt: '...',      // Fallback system prompt
  maxSteps: 10,                    // Max tool-calling rounds (default: 10)
  systemPromptByChannel: {         // Per-channel system prompt override
    web: 'You are a web assistant.',
    whatsapp: 'You are a WhatsApp bot.',
  },

  // Session storage
  conversationStore: 'db',        // 'db' | 'cache' (default: 'db')
  sessionTtl: 3600000,             // Session TTL in ms (null = no expiry)
});
```

## MCP Tool Integration

The chatbot automatically discovers all MCP tools registered via `@McpTool()` decorators and makes them available to the LLM agent. No additional configuration needed — tools are resolved from the `McpRegistryService` at runtime.

If no tools are found, the agent receives a warning in its system prompt and answers from general knowledge only.

## Tool Routing & RAG

> **Migration note:** Tool routing and Knowledge RAG have moved to `najm-rag`. If you were using `mode: 'routing'` or `mode: 'rag'` in your chatbot config, see the [Migration Guide](#migration-from-rag-mode) below.

For new projects, use `najm-rag` for RAG features:

```typescript
import { rag } from 'najm-rag';
import { chatbot } from 'najm-chatbot';

server
  .use(rag({
    dialect: 'sqlite',
    toolRouting: { enabled: true },   // RAG-powered tool routing
    knowledge: true,                 // Document ingestion + search
  }))
  .use(chatbot());                  // Uses the registered tool provider automatically
```

For schema setup with `najm-rag`:

```typescript
import { chatbotSchema } from 'najm-chatbot/sqlite';  // chatbot + chat session tables
import { ragSchema } from 'najm-rag/sqlite';         // tool routing + knowledge tables

const db = drizzle(sqlite, {
  schema: {
    ...chatbotSchema,
    ...ragSchema,
    // your tables...
  },
});
```

## Migration from `mode` (deprecated)

The `mode: 'off' | 'rag' | 'routing'` config option is deprecated. Replace with explicit plugin wiring:

| Old `mode` | New configuration |
|---|---|
| `'off'` | `chatbot()`, no `rag()`, no `mcp()` |
| `'rag'` | `chatbot()` + `rag({ knowledge: true })` |
| `'routing'` | `chatbot()` + `rag({ toolRouting: { enabled: true } })` + `mcp()` |

```typescript
// Before (deprecated)
chatbot({
  dialect: 'sqlite',
  configPath: './src/server/config/chatbot/routing.json',
  mode: 'routing',
})

// After (current)
server
  .use(mcp({ path: '/mcp' }))
  .use(rag({
    dialect: 'sqlite',
    configPath: './src/server/config/chatbot/routing.json',
    toolRouting: { enabled: true },   // replaces mode: 'routing'
  }))
  .use(chatbot())                    // no mode needed
```

Both `mode` and `tools` cannot be set at the same time — if both are present, an error is thrown at boot.

## Database Schema

The plugin provides Drizzle table definitions for three dialects:

```typescript
import { chatbotSchema } from 'najm-chatbot/sqlite';  // or /pg, /mysql
```

The schema exports:

- `aiSettingsTable` — LLM provider configuration (provider, model, API key, base URL, system prompt, enabled flag)
- `chatSessionsTable` — conversation session history (session key, user ID, channel, messages, expiry)
- `chatbotInteractionLogsTable` — chat interaction audit log
- `chatbotToolEmbeddingsTable`, `chatbotToolSemanticsTable`, `chatbotRoutingSettingsTable` — **deprecated**, re-exported from `najm-rag/sqlite` for backward compatibility. For new projects, import from `najm-rag/sqlite` directly.

### Deprecated RAG Table Exports

> **Warning:** Importing RAG tables from `najm-chatbot/sqlite` is deprecated. These tables (`chatbot_tool_embeddings`, `chatbot_tool_semantics`, `chatbot_routing_settings`) are defined in and exported from `najm-rag/sqlite`. They will be removed from `najm-chatbot` in a future major version.

```typescript
// Deprecated (will be removed)
import { chatbotSchema } from 'najm-chatbot/sqlite';
// chatbotSchema.chatbotToolEmbeddings  // ← deprecated re-export

// Recommended
import { chatbotSchema } from 'najm-chatbot/sqlite';
import { ragSchema } from 'najm-rag/sqlite';
// ragSchema.chatbotToolEmbeddings       // ← canonical location
```

Merge with your app schema:

```typescript
import { chatbotSchema } from 'najm-chatbot/sqlite';
import { ragSchema } from 'najm-rag/sqlite';
import { usersTable } from 'najm-auth/sqlite';

const db = drizzle(sqlite, {
  schema: {
    ...chatbotSchema,   // ai_settings, chat_sessions, chatbot_interaction_logs
    ...ragSchema,       // tool embeddings, semantics, routing settings, document tables, audit logs
    usersTable,
    // your tables...
  },
});
```

## Auto-Registered Routes

The plugin registers two controllers:

**AI Settings (`/ai-settings`):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/ai-settings` | `@isAuth()` | Get public settings (API key hidden) |
| `POST` | `/ai-settings` | `@isAdministrator()` | Create or replace settings |
| `PUT` | `/ai-settings` | `@isAdministrator()` | Partial update settings |
| `POST` | `/ai-settings/test` | `@isAdministrator()` | Test LLM connection |

**Chat (`/chat`):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/chat` | `@isAuth()` | Send messages, returns a streaming response |

## Supported LLM Providers

| Provider | Key Required | URL Required | Default Model |
|----------|-------------|--------------|---------------|
| `anthropic` | Yes | No | `claude-sonnet-4-6` |
| `openai` | Yes | No | `gpt-5.4-mini` |
| `google` | Yes | No | `gemini-2.5-flash` |
| `zai` | Yes | Yes | `glm-5.1` |
| `minimax` | Yes | Yes | `MiniMax-M2.7` |
| `qwen` | Yes | Yes | `qwen3.6-plus` |
| `ollama` | No | Yes | `llama3.1` |
| `custom` | No | Yes | — |

## Chat API

### Streaming

```typescript
POST /chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "sessionKey": "optional-session-id"
}
```

Returns an AI SDK data stream response.

### ChatAgent Service

The `ChatAgent` service is the core of the chatbot. You can use it directly in your own services or controllers:

```typescript
import { Service } from 'najm-core';
import { ChatAgent } from 'najm-chatbot';

@Service()
class MyService {
  constructor(private agent: ChatAgent) {}

  async streamChat(messages: UIMessage[], sessionKey?: string) {
    return this.agent.stream({ messages, sessionKey, channel: 'web' });
  }

  async runOnce(messages: UIMessage[]) {
    return this.agent.runOnce({ messages, channel: 'web' });
  }

  async clearHistory(sessionKey: string) {
    return this.agent.clearSession(sessionKey);
  }
}
```

- `stream(input)` — Returns a streaming `Response` (AI SDK data stream).
- `runOnce(input)` — Returns a plain text string (non-streaming).
- `clearSession(key)` — Deletes a conversation session.

## Session Management

Choose between two conversation store backends:

- **`'db'` (default)** — Persists conversations in the `chat_sessions` table. Survives server restarts. Expired sessions are cleaned up hourly.
- **`'cache'`** — Stores conversations in the Najm cache service (in-memory or Redis). Faster but ephemeral.

```typescript
chatbot({
  conversationStore: 'cache',
  sessionTtl: 1800000, // 30 minutes
});
```

Sessions track the channel (`web`, `whatsapp`, or `other`) and optionally the user ID from the authenticated request.

## React UI

The package ships a ready-to-use React chatbot component. Import from `najm-chatbot/react`:

> **Required — Tailwind styles.** The components ship no compiled CSS; they use
> Tailwind utility classes generated by *your* app's Tailwind v4 build. Add this
> once to your global stylesheet or the components render unstyled (the chat
> launcher ends up off-screen and transparent):
>
> ```css
> @import "tailwindcss";
> @import "najm-chatbot/styles.css";
> ```

```tsx
import { Chatbot } from 'najm-chatbot/react';

function App() {
  return (
    <Chatbot
      apiPath="/chat"
      settingsApiPath="/ai-settings"
      mcpApiPath="/mcp"
      suggestions={['What can you do?', 'Help me with...']}
      initialOpen={false}
      theme={{ primary: '#6366f1', radius: '12px' }}
    />
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `apiPath` | `string` | Chat endpoint path |
| `settingsApiPath` | `string` | AI settings endpoint path |
| `mcpApiPath` | `string` | MCP discovery endpoint path |
| `sessionKey` | `string` | Session key for conversation persistence |
| `suggestions` | `ChatbotSuggestionInput[]` | Quick-action suggestion buttons |
| `initialOpen` | `boolean` | Open the panel on mount |
| `initialSize` | `'sm' \| 'md' \| 'lg' \| 'xl'` | Panel size |
| `theme` | `ChatbotTheme` | Theme colors (`primary`, `radius`, `accent`, `codeBg`) |
| `slots` | `Partial<ChatbotSlots>` | Override individual UI slots (Trigger, Header, Message, Input, EmptyState) |
| `i18n` | `I18nFn` | Translation function for UI labels |
| `className` | `string` | Root element class |
| `panelClassName` | `string` | Panel element class |

### Hooks

```tsx
import {
  useChatPanel,
  useAiSettings,
  useToolStatus,
  useAuthenticatedFetch,
} from 'najm-chatbot/react';
```

### Composable Components

For full control, compose your own UI from the individual components:

```tsx
import {
  ChatPanel,
  ChatInput,
  ChatMessages,
  AiSettingsForm,
} from 'najm-chatbot/react';
```

## Testing

The package exports test utilities from `najm-chatbot/testing`:

```typescript
import { describe, test, expect, afterEach } from 'bun:test';
import { createTestChatbot, scriptedModel } from 'najm-chatbot/testing';

let result: TestChatbotResult;
afterEach(async () => { await result?.server?.stop(); });

test('chat returns a reply', async () => {
  result = await createTestChatbot({
    cannedText: 'Hello from AI!',
    port: 3610,
  });

  const res = await fetch('http://localhost:3610/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });

  expect(res.ok).toBe(true);
});
```

### `createTestChatbot(options?)`

Creates a fully wired test server with an in-memory SQLite database, fake auth, MCP, and a scripted LLM model.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cannedText` | `string \| string[]` | `'test reply'` | Predefined model responses |
| `toolCalls` | `TestToolCallScript[]` | `[]` | Simulated tool calls |
| `port` | `number` | random 3500–3999 | Server port |
| `chatbotConfig` | `Record<string, any>` | `{}` | Additional chatbot plugin config |

### `scriptedModel(input)`

Creates a scripted AI SDK v6 test model that returns canned text or simulates tool calls. Useful for unit-testing `ChatAgent` directly.

## Exported API

```typescript
// Plugin
export { chatbot } from 'najm-chatbot';
export type { ChatbotConfig, ChatbotDialect } from 'najm-chatbot';

// AI Settings
export {
  AiSettingsController,
  AiSettingsService,
  AiSettingsRepository,
  createAiSettingsDto,
  updateAiSettingsDto,
  LLM_PROVIDER_ENUM,
} from 'najm-chatbot';

// LLM Provider Factory
export { buildModel, PROVIDERS, PROVIDER_OPTIONS, buildAiSdkTools, schemaToZod } from 'najm-chatbot';

// Agent
export { ChatAgent } from 'najm-chatbot';
export { ChatController } from 'najm-chatbot';

// Sessions
export {
  ChatSessionRepository,
  ChatSessionCleanupService,
  DbConversationStore,
  CacheConversationStore,
} from 'najm-chatbot';

// Schema
export { chatbotSchema } from 'najm-chatbot/sqlite';
export { chatbotSchema } from 'najm-chatbot/pg';
export { chatbotSchema } from 'najm-chatbot/mysql';

// React UI (optional — requires react peer dep)
export { Chatbot, ChatPanel, ChatInput, ChatMessages, AiSettingsForm } from 'najm-chatbot/react';

// Testing
export { createTestChatbot, scriptedModel } from 'najm-chatbot/testing';
```

## Architecture

```
najm-chatbot/
├── src/
│   ├── ai-settings/         # LLM provider settings CRUD
│   │   ├── AiSettingsController.ts
│   │   ├── AiSettingsService.ts
│   │   ├── AiSettingsRepository.ts
│   │   ├── AiSettingsDto.ts
│   │   └── index.ts
│   ├── agent/               # Core chat agent
│   │   ├── ChatAgent.ts          # Stream/generate with MCP tools
│   │   ├── LlmProviderFactory.ts  # Provider → AI SDK model factory
│   │   └── McpToolAdapter.ts     # MCP tools → AI SDK tools adapter
│   ├── chat/                # Chat HTTP endpoint
│   │   └── ChatController.ts
│   ├── sessions/            # Conversation session management
│   │   ├── ChatSessionRepository.ts
│   │   ├── ChatSessionCleanupService.ts
│   │   ├── ConversationStore.ts   # DB and Cache store implementations
│   │   ├── ChatSessionSchema.ts  # Types and utilities
│   │   └── index.ts
│   ├── schema/              # Drizzle table definitions
│   │   ├── sqlite.ts
│   │   ├── pg.ts
│   │   └── mysql.ts
│   ├── react/               # React UI components and hooks
│   ├── testing/            # Test utilities
│   ├── ChatbotPlugin.ts     # Plugin definition
│   ├── tokens.ts           # DI tokens
│   └── index.ts             # Public API exports
```

## RAG & Tool Routing (deprecated)

For backward compatibility, `najm-chatbot` still re-exports RAG tables from `najm-rag/sqlite`. This is deprecated and will be removed in a future major version. Use `najm-rag/sqlite` for all RAG-related schema:

```typescript
// Old (deprecated)
import { chatbotSchema } from 'najm-chatbot/sqlite';
// chatbotSchema.chatbotToolEmbeddings  // deprecated

// New
import { chatbotSchema } from 'najm-chatbot/sqlite';
import { ragSchema } from 'najm-rag/sqlite';
```

See [najm-rag README](packages/najm-rag/README.md) for the full RAG and tool routing documentation.
