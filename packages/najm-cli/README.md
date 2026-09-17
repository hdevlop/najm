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

Preview and initialize a Next.js App Router project with the shared Najm app
integration. The command asks independently about Auth, Theme, and a disabled,
Leaflet, or Google location runtime. It generates `najm.config.ts`, the
server-only binding, client provider composition, a static proxy matcher, CSP
reporting, root layout, and thin API routes.

Full profiles declare the generated app name in `defineNajmApp` and mount the
direct `NajmAppProvider` from `najm-next/app/client`; display defaults flow
through the public snapshot and Query uses the full provider's shared defaults.
minimal or partial profiles keep using the dependency-neutral low-level
composer so they do not install Auth, Theme, Query, or a map SDK unnecessarily.

```bash
najm init next my-next-app
```

The preview labels every target `create`, `unchanged`, or `conflict`. A conflict
aborts before any file or dependency changes. Re-running an unchanged scaffold
is idempotent. The CLI never writes real secrets or resets a database. Runtime
location values stay in app-owned environment variables such as
`MY_APP_LOCATION_MAP_PROVIDER` and `MY_APP_LOCATION_GOOGLE_API_KEY`.

Generated integrations require at least `najm-next@0.6.0`; optional profiles
pin `najm-auth@4.0.4`, `najm-kit@2.15.0`, and `najm-theme@0.2.1`.

### `najm new <type> <name>`

Generate a scaffolded component. Supported types:

```bash
najm new controller product    # → src/features/product/product.controller.ts
najm new service product      # → src/features/product/product.service.ts
najm new repository product   # → src/features/product/product.repository.ts
najm new module product       # → full feature module
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
