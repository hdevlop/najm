// ============================================================================
// najm-theme/server — the 0.1.x factory surface, kept alive for one minor
// ============================================================================
//
// `defineTheme` replaces everything in this file. It is here because 0.1.1
// exported `createFactoryDesignGetter` and consumers call it: removing it in
// 0.2.0 would be a breaking change in a minor release, and the one consumer
// that exists (Kafil) fails to compile without it.
//
// The compatibility promise is narrow and dated: the `factory` callbacks on the
// plugin config still resolve in 0.2.0, and this helper builds the appearance
// half of them. Both are removed in 0.3.0, by which point a consumer should own
// a canonical `theme/` directory and call `defineTheme(import.meta.url)`.
// ============================================================================

import { parseSafeDesignConfig, type ThemeAppearanceLimits } from "../contracts";
import type { NajmDesignConfig } from "../contracts";

/**
 * Builds the factory-design callback the plugin config's `factory.appearance`
 * expects, from a statically imported `theme.json`.
 *
 * @deprecated Since 0.2.0; removed in 0.3.0. Use `defineTheme(import.meta.url)`
 * from `najm-theme/theme` and pass the definition to `theme(definition, …)`.
 * The definition also carries the four factory assets and the bytes they are
 * served from, none of which this helper can express.
 *
 * Parses once and clones per call, exactly as 0.1.1 did. The clone is what
 * stops a caller mutating the design every later read will return, and the
 * parse is deliberately *not* wrapped: a `theme.json` that cannot be validated
 * is a broken build, and returning a silent default would hide it behind a page
 * that merely looks unstyled.
 */
export function createFactoryDesignGetter(
  themeJson: unknown,
  limits?: ThemeAppearanceLimits,
): () => NajmDesignConfig {
  const design = parseSafeDesignConfig(themeJson, limits);
  return () => structuredClone(design);
}
