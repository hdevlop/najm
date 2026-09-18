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
/**
 * Status labels live beside the badge vocabulary they belong to, and are
 * re-exported here because the text form is needed off the client too — a
 * server component naming a status in a sentence, an export, an email. Pure
 * data and pure functions, so the `react-server` constraint above holds.
 */
export {
  DEFAULT_STATUS_KEY_PREFIX,
  DEFAULT_STATUS_LABEL_LANGUAGE,
  NAJM_STATUS_LABELS,
  findPackagedStatusLabel,
  findStatusLabel,
  formatStatusLabel,
  resolveStatusLabelLanguage,
} from "../components/Badge/statusLabels";
export type { NajmStatusLabelOptions } from "../components/Badge/statusLabels";
