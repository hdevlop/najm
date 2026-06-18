# RAG Studio App

Standalone downloadable RAG Studio for Najm.

This app is the consumer-facing tool. It builds to a static export in `out/` and
can be hosted separately from any Najm application.

The app owns the Studio UI source directly under `apps/rag-studio/src/studio`.
Consumers should download or host this app artifact, not embed the studio UI
inside their own app.

## Build

From the repo root:

```powershell
bun run build:rag-studio
```

Output:

```text
apps/rag-studio/out
```

## Run Locally

```powershell
bun run --cwd apps/rag-studio dev
```

The app runs on port `4100` by default.

## Target App Requirement

The standalone app connects to a running Najm API. The target API must expose the
RAG Studio admin endpoints, for example:

```ts
import { rag } from 'najm-rag';
import { ragStudio } from 'najm-rag';

new Server()
  .use(auth(...))
  .use(database(...))
  .use(rag(...))
  .use(ragStudio({ ui: false }));
```

`ui: false` means the target app exposes only the admin API. The standalone app
provides the UI separately.
