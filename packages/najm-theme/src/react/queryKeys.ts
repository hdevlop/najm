// ============================================================================
// najm-theme/react — canonical query keys
// ============================================================================
//
// Owned by the package, not by each consumer. Three applications that each
// invented `["appearance"]` would each also have to remember to invalidate it
// after a preset apply, after a reset, and after a branding save that changed
// nothing about appearance — and the third one always forgets.
//
// Namespaced under `najm-theme` and scoped by base URL, so two providers
// pointed at different backends (a platform console and a tenant preview in one
// page) do not share a cache entry.
// ============================================================================

const ROOT = "najm-theme" as const;

export const themeQueryKeys = {
  all: (baseUrl: string) => [ROOT, baseUrl] as const,

  appearance: (baseUrl: string) => [ROOT, baseUrl, "appearance"] as const,
  /** The administrative read: design, revision, provenance, capabilities. */
  appearanceConfig: (baseUrl: string) => [ROOT, baseUrl, "appearance", "config"] as const,

  branding: (baseUrl: string) => [ROOT, baseUrl, "branding"] as const,
  /** The administrative read: slot metadata, provenance, capabilities. */
  brandingConfig: (baseUrl: string) => [ROOT, baseUrl, "branding", "config"] as const,

  presets: (baseUrl: string) => [ROOT, baseUrl, "presets"] as const,
} as const;

export type ThemeQueryKey = ReturnType<
  (typeof themeQueryKeys)[keyof typeof themeQueryKeys]
>;
