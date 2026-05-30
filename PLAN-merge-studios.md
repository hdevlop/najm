# Plan: Merge Studios into Parent Packages

Merge the studio UI packages into their parent packages using subpath exports while preserving the existing backend package surfaces.

| Studio package removed | Parent package | New import |
|---|---|---|
| `najm-storage-studio` | `najm-storage` | `najm-storage/studio` |
| `najm-whatsapp-studio` | `najm-whatsapp` | `najm-whatsapp/studio` |
| `najm-rag-studio` | `najm-rag` | `najm-rag/studio` |
| `nnajm-rag-studio` | none | delete typo duplicate |

Compatibility rule: do not remove or rename any existing parent package exports. Keep `najm-storage`, `najm-whatsapp`, and `najm-rag` backend imports working, including schema subpaths such as `./sqlite`, `./pg`, and `./mysql`.

---

## Target Shape

For each parent package:

```text
packages/najm-storage/
├── src/
│   ├── index.ts
│   ├── schema/
│   │   ├── sqlite.ts
│   │   ├── pg.ts
│   │   └── mysql.ts
│   └── studio/               # moved from packages/najm-storage-studio/src/
│       ├── app/
│       ├── features/
│       ├── providers/
│       ├── routes/
│       ├── shared/
│       ├── styles/
│       └── index.ts
├── scripts/
│   └── build-css.mjs         # moved from studio package and updated
├── tailwind.config.ts         # moved from studio package
├── tsup.config.ts             # extended, not replaced
└── package.json               # existing exports plus studio subpaths
```

Apply the same shape to `najm-whatsapp` and `najm-rag`.

---

## Build Rules

Do not paste a brand-new backend build config over the parent config. Extend the current `tsup.config.ts` files.

Required rules:

- Keep all existing backend entries, including `src/schema/sqlite.ts`, `src/schema/pg.ts`, and `src/schema/mysql.ts` where present.
- Keep each package's existing output extension:
  - `najm-storage`: currently `.js`
  - `najm-whatsapp`: `.mjs`
  - `najm-rag`: `.mjs`
- Keep `bundle`, `skipNodeModulesBundle`, current backend `external` values, and current `dts.compilerOptions`.
- Keep the existing `preserve-metadata` esbuild plugin on backend builds so decorator metadata remains intact.
- Add a second studio build entry: `{ 'studio/index': 'src/studio/index.ts' }`.
- Ensure only one config cleans `dist`; the studio build must not delete backend outputs. Prefer backend `clean: true`, studio `clean: false`.
- Use the studio alias plugin for `@/` imports after moving source under `src/studio`.
- Update CSS build scripts to output `dist/studio/styles.css`.

Studio CSS script change:

```ts
const input = path.join(rootDir, 'src', 'studio', 'styles', 'index.css');
const output = path.join(rootDir, 'dist', 'studio', 'styles.css');
```

If a moved studio has a different internal style path, adjust `input` to match the moved file.

---

## Package Exports

Add the new studio exports without removing existing exports.

### `najm-storage`

Keep the existing `.` and schema exports, then add:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./sqlite": {
      "types": "./dist/schema/sqlite.d.ts",
      "import": "./dist/schema/sqlite.js",
      "default": "./dist/schema/sqlite.js"
    },
    "./pg": {
      "types": "./dist/schema/pg.d.ts",
      "import": "./dist/schema/pg.js",
      "default": "./dist/schema/pg.js"
    },
    "./mysql": {
      "types": "./dist/schema/mysql.d.ts",
      "import": "./dist/schema/mysql.js",
      "default": "./dist/schema/mysql.js"
    },
    "./studio": {
      "types": "./dist/studio/index.d.ts",
      "import": "./dist/studio/index.mjs",
      "default": "./dist/studio/index.mjs"
    },
    "./studio/styles.css": {
      "import": "./dist/studio/styles.css",
      "default": "./dist/studio/styles.css"
    }
  }
}
```

### `najm-whatsapp`

Keep the existing `.` and schema exports, then add:

```json
{
  "exports": {
    "./studio": {
      "types": "./dist/studio/index.d.ts",
      "import": "./dist/studio/index.mjs",
      "default": "./dist/studio/index.mjs"
    },
    "./studio/styles.css": {
      "import": "./dist/studio/styles.css",
      "default": "./dist/studio/styles.css"
    }
  }
}
```

### `najm-rag`

Keep the existing `.` and schema exports, then add:

```json
{
  "exports": {
    "./studio": {
      "types": "./dist/studio/index.d.ts",
      "import": "./dist/studio/index.mjs",
      "default": "./dist/studio/index.mjs"
    },
    "./studio/styles.css": {
      "import": "./dist/studio/styles.css",
      "default": "./dist/studio/styles.css"
    }
  }
}
```

---

## Dependency Policy

Use this rule consistently:

- `react` and `react-dom` stay as `peerDependencies`.
- Studio libraries required at runtime should be regular `dependencies` of the parent package unless they are bundled intentionally.
- Build/test-only packages stay in `devDependencies`.

Move the studio package dependencies into the parent packages as needed.

Likely runtime dependencies to preserve:

- Storage studio: `@tanstack/react-router`, `clsx`, `lucide-react`, `najm-ui`, `recharts`, `sonner`, `swr`, `tailwind-merge`.
- WhatsApp studio: `@tanstack/react-router`, `clsx`, `lucide-react`, `najm-ui`, `qrcode.react`, `react-window`, `recharts`, `sonner`, `tailwind-merge`.
- RAG studio: `@tanstack/react-query`, `@tanstack/react-router`, CodeMirror packages, `@uiw/react-codemirror`, `@lezer/highlight`, `clsx`, `lucide-react`, `najm-chatbot`, `najm-ui`, `recharts`, `tailwind-merge`.

If a dependency is listed in the studio `external` array, it must be present in parent `dependencies` or `peerDependencies`.

---

## Static Serving Updates

`najm-rag` currently resolves the deleted `najm-rag-studio` package in `src/studio/RagStudioStaticController.ts`.

Update it to resolve assets from the merged package:

- Prefer resolving `najm-rag/package.json`, then use `join(dirname(pkgJsonPath), 'dist', 'studio')`.
- Fallback from source should point to the local parent package `dist/studio`, not sibling `najm-rag-studio/dist`.
- Update error text from `Run bun run build in najm-rag-studio` to `Run bun run build:rag` or `Run bun run build in packages/najm-rag`.

Search for similar static-serving references in `najm-storage` and `najm-whatsapp` before deleting the old packages.

---

## Tests

Move tests with the studio source instead of deleting coverage.

Recommended locations:

```text
packages/najm-storage/test/studio/
packages/najm-whatsapp/test/studio/
packages/najm-rag/test/studio/
```

Current storage studio tests use `bun test --preload ./test/setup.ts`; keep or adapt that preload after moving.

Update parent package test scripts if needed:

```json
{
  "scripts": {
    "test": "bun test"
  }
}
```

If a parent package needs a separate studio test preload, use a package-local test setup file and document it in the script.

---

## Playground Updates

Update imports:

```ts
import { StorageStudio, StorageStudioProvider } from 'najm-storage/studio';
import 'najm-storage/studio/styles.css';

import { WhatsAppStudioProvider, WhatsAppStudio } from 'najm-whatsapp/studio';
import 'najm-whatsapp/studio/styles.css';

import { RagStudio, RagStudioProvider } from 'najm-rag/studio';
import 'najm-rag/studio/styles.css';
```

Update `apps/playground/tsconfig.json` paths:

```json
{
  "compilerOptions": {
    "paths": {
      "najm-storage/studio": ["../../packages/najm-storage/src/studio/index.ts"],
      "najm-storage/studio/*": ["../../packages/najm-storage/src/studio/*"],
      "najm-storage/studio/styles.css": ["../../packages/najm-storage/dist/studio/styles.css"],

      "najm-whatsapp/studio": ["../../packages/najm-whatsapp/src/studio/index.ts"],
      "najm-whatsapp/studio/*": ["../../packages/najm-whatsapp/src/studio/*"],
      "najm-whatsapp/studio/styles.css": ["../../packages/najm-whatsapp/dist/studio/styles.css"],

      "najm-rag/studio": ["../../packages/najm-rag/src/studio/index.ts"],
      "najm-rag/studio/*": ["../../packages/najm-rag/src/studio/*"],
      "najm-rag/studio/styles.css": ["../../packages/najm-rag/dist/studio/styles.css"]
    }
  }
}
```

Remove old aliases:

- `najm-storage-studio`
- `najm-storage-studio/styles.css`
- `najm-storage-studio/package.json`
- `najm-whatsapp-studio`
- `najm-whatsapp-studio/styles.css`
- `najm-whatsapp-studio/package.json`
- `najm-rag-studio`
- `najm-rag-studio/styles.css`
- `najm-rag-studio/package.json`

Update `apps/playground/package.json`:

- Remove `najm-storage-studio`, `najm-whatsapp-studio`, and `najm-rag-studio`.
- Keep parent packages: `najm-storage`, `najm-whatsapp`, and `najm-rag`.

Update or remove ambient declarations under `apps/playground/src/types/` that mention old studio package names.

---

## Workspace And Script Cleanup

Update these files before deleting folders:

- `scripts/workspaces.ts`: remove studio package targets.
- Root `package.json`: remove or repoint scripts such as `build:rag:studio`, `build:storage-studio`, `build:whatsapp-studio`, and `test:storage-studio`.
- `scripts/build-rag.ts`: remove the separate `packages/najm-rag-studio` build and build only `packages/najm-rag`.
- Root `tsconfig.json`: remove old studio path aliases and project references; add parent studio subpath aliases only if needed.
- `apps/playground/tsconfig.json`: replace old studio aliases.
- `bun.lock`: regenerate after package and workspace changes.
- README/docs references: update install/import examples from `najm-*-studio` to parent subpaths.

`turbo.json` currently has generic tasks and no explicit package names, so no package-specific cleanup is expected there unless new explicit entries are added later.

---

## Migration Steps

1. Move each studio `src/` to parent `src/studio/`.
2. Move each studio `scripts/build-css.mjs` to parent `scripts/build-css.mjs` and update CSS input/output paths.
3. Move each studio `tailwind.config.ts` to the parent package root.
4. Move studio tests into parent package test folders.
5. Extend parent `tsup.config.ts` files while preserving backend entries, metadata plugins, and schema builds.
6. Add `./studio` and `./studio/styles.css` exports to parent `package.json` files.
7. Move studio dependencies into parent package manifests according to the dependency policy.
8. Update static-serving code, especially `najm-rag/src/studio/RagStudioStaticController.ts`.
9. Update playground imports, dependencies, path aliases, and ambient declarations.
10. Update root scripts, `scripts/workspaces.ts`, `scripts/build-rag.ts`, root `tsconfig.json`, docs, and README references.
11. Delete `packages/najm-storage-studio/`, `packages/najm-whatsapp-studio/`, `packages/najm-rag-studio/`, and `packages/nnajm-rag-studio/`.
12. Run `bun install` to regenerate `bun.lock`.

---

## Verification

Build:

```powershell
bun run build:storage
bun run build:whatsapp
bun run build:rag
```

Import checks:

```powershell
bun -e "import('najm-storage/studio').then(() => console.log('storage studio ok'))"
bun -e "import('najm-whatsapp/studio').then(() => console.log('whatsapp studio ok'))"
bun -e "import('najm-rag/studio').then(() => console.log('rag studio ok'))"
```

Test:

```powershell
bun run test:storage
bun run test:whatsapp
bun run test:rag
```

Playground:

```powershell
bun run playground:next:build
```

Also verify these imports still work:

```ts
import 'najm-storage/sqlite';
import 'najm-storage/pg';
import 'najm-storage/mysql';
import 'najm-whatsapp/sqlite';
import 'najm-rag/sqlite';
```
