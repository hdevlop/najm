/**
 * A normalizer turns one raw login identifier into the canonical form stored on
 * the user record. Returning `null`/`undefined` means "not mine" and hands the
 * value to the next normalizer in the pipeline.
 */
export type IdentityNormalizer = (value: string) => string | null | undefined;

export interface IdentityPreset {
  /** Stable preset name, e.g. `ma`. */
  name: string;
  /** Local-format normalization for that country. */
  normalize: IdentityNormalizer;
}

/** Built-in country presets. */
export type IdentityPresetName = 'ma' | 'tn';

export interface IdentityConfig {
  /**
   * Country preset for local phone numbers (default: `'ma'`). Pass another
   * preset to replace Morocco, or `null` to keep only generic email/E.164
   * handling. Local numbers are country-ambiguous, so presets replace each
   * other instead of stacking.
   */
  preset?: IdentityPresetName | IdentityPreset | null;
  /**
   * Project-specific identifiers (employee number, student number…). These run
   * before the selected country preset.
   */
  extend?: IdentityNormalizer[];
}

/** Identity policy resolved once for one auth plugin/server instance. */
export interface ResolvedIdentityConfig {
  resolve(value: unknown): string | null;
}
