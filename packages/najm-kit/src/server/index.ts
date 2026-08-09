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
