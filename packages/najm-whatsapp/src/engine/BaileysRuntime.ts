/**
 * BaileysRuntime — single, test-overridable loader for `@whiskeysockets/baileys`.
 *
 * Three production modules previously kept independent module-global promises
 * for the same dynamic import. Tests globally mocked the package, and Bun
 * retained the mock across files, which caused cross-file order-dependent
 * failures. This loader centralizes the import and exposes a test seam.
 */

type BaileysModule = any;
type BaileysLoader = () => Promise<BaileysModule>;

let loader: BaileysLoader = () => import('@whiskeysockets/baileys');
let cached: Promise<BaileysModule> | undefined;

export function loadBaileys(): Promise<BaileysModule> {
  if (!cached) cached = loader();
  return cached;
}

export function setBaileysLoaderForTest(next: BaileysLoader): void {
  loader = next;
  cached = undefined;
}

export function resetBaileysLoaderForTest(): void {
  loader = () => import('@whiskeysockets/baileys');
  cached = undefined;
}

export function getBaileysExport(mod: BaileysModule, key: string): any {
  return mod?.[key] ?? mod?.default?.[key];
}
