/**
 * `najm-next/instrumentation/client` — shared strict-CSP client initializer.
 *
 * Minimal and client-only: this module has no imports and touches no DOM, so
 * importing it is safe in any runtime. It must be executed from the app's
 * `src/instrumentation-client.ts`, which Next.js runs after the HTML document
 * loads and before React hydration begins:
 *
 * ```ts
 * // src/instrumentation-client.ts
 * import { initNajmZodStrictCsp } from "najm-next/instrumentation/client";
 *
 * initNajmZodStrictCsp();
 * ```
 *
 * Timing contract (verified against installed Zod 4.4.x): Zod reads
 * `globalThis.__zod_globalConfig` at import time, and pre-populating
 * `{ jitless: true }` before Zod loads takes effect immediately for every
 * instance (CJS/ESM/multiple bundles share the same global). With `jitless`
 * set, Zod skips its `new Function` capability probe — under a strict CSP
 * that probe is reported as a `securitypolicyviolation` even though the throw
 * is swallowed. Instrumentation-client execution precedes hydration, hence
 * precedes any form-schema evaluation, so no inline `<Script>` (and no
 * duplicate initialization) is required.
 */

type ZodGlobalConfig = {
  jitless?: boolean;
};

type GlobalWithZodConfig = typeof globalThis & {
  __zod_globalConfig?: ZodGlobalConfig;
};

/**
 * Opt Zod into JIT-less evaluation before it loads. Idempotent and
 * non-destructive: an existing global config object (and any keys already on
 * it) is preserved.
 */
export function initNajmZodStrictCsp(): void {
  const host = globalThis as GlobalWithZodConfig;
  host.__zod_globalConfig ??= {};
  host.__zod_globalConfig.jitless = true;
}

// Side-effect import support: `import "najm-next/instrumentation/client"`
// from `instrumentation-client.ts` initializes immediately at the framework's
// pre-hydration point. Gated on `window` so server-side imports stay inert
// and never change server Zod behavior.
if (typeof window !== "undefined") {
  initNajmZodStrictCsp();
}
