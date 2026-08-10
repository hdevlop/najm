#!/usr/bin/env bun
// ============================================================================
// Najm Theme 0.2 acceptance — disposable SQLite bootstrap
// ============================================================================
//
// Builds a fresh SQLite database under `.runtime/`, applies the playground
// migrations, and seeds the demo admin so a tester can sign in without
// resetting the developer's local `playground.db`.
//
// Used by:
//
//   ```powershell
//   $env:DATABASE_URL = '../../.runtime/playground-theme-acceptance.db'
//   bun run --cwd apps/playground db:migrate
//   bun run --cwd apps/playground db:seed
//   ```
//
// Idempotent — a second run drops and recreates the file.
// ============================================================================

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../..");
const RUNTIME = resolve(ROOT, ".runtime");
const DB = resolve(RUNTIME, "playground-theme-acceptance.db");

mkdirSync(RUNTIME, { recursive: true });

if (existsSync(DB)) {
  rmSync(DB);
  console.log(`removed existing ${DB}`);
}

console.log(`disposable database will be created at ${DB}`);
console.log("");
console.log("Run from the repo root with DATABASE_URL pointing at this file:");
console.log("");
console.log("  $env:DATABASE_URL='../../.runtime/playground-theme-acceptance.db'");
console.log("  bun run --cwd apps/playground db:migrate");
console.log("  bun run --cwd apps/playground db:seed");
console.log("");
console.log("Seeded admin: admin@admin.com / Admin123!");
