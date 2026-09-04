// ============================================================================
// najm-kit — the canonical supported time zones
// ============================================================================
//
// One list, read by `TimeZoneInput` and by the server preference contract in
// `najm-kit/server`. It lives here, in a module with no React and no imports,
// precisely so both can reach it: the input file cannot be the source, because
// importing a `.tsx` component from a route handler pulls Radix and the whole
// component graph into the server bundle.
//
// The failure this prevents is not hypothetical. An application that keeps its
// own server-side allow-list drifts from whatever the input offers, and the
// symptom is a zone a user can pick from the dropdown and cannot save.
// ============================================================================

/**
 * IANA zone identifiers offered by `TimeZoneInput` and accepted by the default
 * preference handlers.
 *
 * Broad enough to cover the regions Najm applications ship to, deliberately
 * not the full IANA database — a 400-entry combobox is not a usable control,
 * and every entry here is a value the server contract must keep accepting.
 * Each one is verified against `Intl.DateTimeFormat` in the package tests, so
 * a typo cannot be published.
 */
export const NAJM_TIME_ZONES = [
  "UTC",
  "Atlantic/Azores",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Cairo",
  "Africa/Nairobi",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/** One of the canonical zones. Applications with a custom list infer their own. */
export type NajmTimeZone = (typeof NAJM_TIME_ZONES)[number];

/** The zone assumed when an application configures none. */
export const NAJM_DEFAULT_TIME_ZONE: NajmTimeZone = "UTC";
