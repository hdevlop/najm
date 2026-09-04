// ============================================================================
// najm-kit/server — server-safe entry
// ============================================================================
//
// Deliberately separate from the root barrel. `najm-kit` reaches the whole
// component library, so importing it from a server component resolves
// react-hook-form under the `react-server` condition and fails the build. This
// entry carries no component, no context, and no React import at all.
// ============================================================================

export {
  createUiBootstrapLoader,
  type UiBootstrapConfig,
  type UiBootstrapDiagnostic,
  type UiBootstrapFailureReason,
  type UiBootstrapFetcher,
  type UiBootstrapLoader,
  type UiBootstrapResource,
  type UiBootstrapResources,
  type UiBootstrapSnapshot,
  type UiBootstrapValue,
} from "./uiBootstrap";

// Language, theme, and time-zone preferences: the cookie contract an
// application would otherwise hand-write across three route handlers and a
// root layout. Pure — Web `Request`/`Response` and a structural cookie reader.
export {
  defineNajmPreferences,
  type NajmCookieReader,
  type NajmPreferenceCookieNames,
  type NajmPreferenceCookieOptions,
  type NajmPreferenceHandler,
  type NajmPreferenceHandlers,
  type NajmPreferenceI18n,
  type NajmPreferenceLanguage,
  type NajmPreferenceResolveOptions,
  type NajmPreferenceSnapshot,
  type NajmPreferenceTimeZone,
  type NajmPreferences,
  type NajmPreferencesConfig,
} from "./preferences";

// The canonical zone list, shared with `TimeZoneInput`. Exported so an
// application can assert the two agree rather than copy one into the other.
export { NAJM_DEFAULT_TIME_ZONE, NAJM_TIME_ZONES, type NajmTimeZone } from "../lib/timeZones";

// The theme mode union, so a consumer types its layout and providers without
// declaring a competing `"light" | "dark"`.
export type { NajmMode } from "../theme/types";

// The design surface, re-exported so an appearance resource can be parsed
// without reaching the root barrel. Same functions, same behaviour — these are
// pure and hold no module state, so the second copy the bundler may emit
// carries no identity the way a React context would.
export {
  defineNajmDesignConfig,
  parseNajmDesignConfig,
  stringifyNajmDesignConfig,
} from "../theme/design-config";
export type {
  NajmComponentThemeConfig,
  NajmDesignConfig,
  NajmLayoutConfig,
  NajmTypographyConfig,
} from "../theme/design-types";
