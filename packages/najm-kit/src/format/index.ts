/**
 * Server-safe formatters — the `najm-kit/format` entry.
 *
 * Pure functions only, and deliberately so. `NajmFormatProvider` and
 * `useNajmFormat` are *not* re-exported here: they call `createContext`, which
 * does not exist on `react` under the `react-server` condition, so a route
 * handler or server component importing this entry would crash on module
 * evaluation. Both are exported from the root entry, which client code uses.
 */
export {
  DEFAULT_PLACEHOLDER,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  humanizeToken,
  localDateInput,
  slugify,
} from "./format";
export type { NajmFormatConfig, SlugifyOptions } from "./format";
