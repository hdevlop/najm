# najm-cli

CLI scaffolding tool for Najm projects. Generate controllers, services, modules, Next.js apps, and more.

## Install

```bash
bun add -g najm-cli
```

Or use without installing:

```bash
bunx najm-cli create my-project
```

## Commands

### `najm create <project-name>`

Scaffold a new Najm project with TypeScript, DI, and recommended structure.

```bash
najm create my-api
```

### `najm init next [project-name]`

Initialize Next.js with Najm backend (App Router).

```bash
najm init next my-next-app
```

### `najm new <type> <name>`

Generate a scaffolded component. Supported types:

```bash
najm new controller product    # → src/features/product/product.controller.ts
najm new service product      # → src/features/product/product.service.ts
najm new repository product   # → src/features/product/product.repository.ts
najm new module product       # → full feature module
```

### `najm generate <type> <name>`

Alias for `najm new`.

```bash
najm generate controller user
```

### `najm database <action>`

Database management.

```bash
najm database migrate   # Run pending migrations
najm database seed       # Seed the database
```

### `najm chat:seed`

Seed chatbot data (LLM providers, initial configuration).

```bash
najm chat:seed
```

### `najm rag:init`

Scaffold RAG config files (`routing.json`, `semantics.json`, `routing-test-cases.json`).

```bash
najm rag:init
```

### `najm rag:scan`

Scan MCP tools and auto-generate semantic phrases for RAG routing.

```bash
najm rag:scan           # Scan and write to semantics.json
najm rag:scan --dry-run  # Preview without writing
najm rag:scan --prune    # Remove orphaned entries
```

## Production Notes

- CLI is a development tool — do not include in production container
- Generated projects include `.env.example` with required variables
- Run `najm init next` for production-ready Next.js + Najm setup