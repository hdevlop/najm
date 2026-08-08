/**
 * Locale-aware value formatting.
 *
 * Pure functions with no React and no DOM: every input arrives through
 * `NajmFormatConfig`. `NajmFormatProvider` binds them to the live locale and
 * time zone, and is what an application normally uses — these are exported for
 * the server, where there is no context to read.
 */

/** Rendered in place of a value that is absent or not formattable. */
export const DEFAULT_PLACEHOLDER = "—";

export interface NajmFormatConfig {
  /** BCP 47 tag handed to `Intl`, e.g. `"fr-MA"`. */
  locale: string;
  /**
   * IANA zone every date is rendered in. Omitted means the host zone, which is
   * the runtime's guess rather than the user's preference — supply it.
   */
  timeZone?: string;
  /** ISO 4217 code for `formatCurrency`, e.g. `"MAD"`. */
  currency?: string;
  /** Defaults to an em dash. */
  placeholder?: string;
}

/**
 * `Intl` formatters cost far more to construct than to call, and a table cell
 * formats once per row per paint. Keyed by every input that changes the output.
 */
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(
  locale: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${options ? JSON.stringify(options) : ""}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

/**
 * How many minor units make one major unit, as the currency itself defines it.
 *
 * Read off `Intl` rather than assumed to be 100: JPY has no minor unit and
 * dividing it by 100 would render every amount at a hundredth of its value,
 * while KWD has three digits and would be off by ten. The application states
 * the currency; the exponent is not another thing for it to get right.
 */
function minorUnitScale(locale: string, currency: string): number {
  const digits =
    numberFormat(locale, { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return 10 ** digits;
}

function toDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Formats an integer count of minor units — cents, centimes — as currency.
 *
 * Minor units are the input because money that survives a round trip is an
 * integer; a major-unit float cannot represent 0.1 exactly and has no business
 * in a ledger. A non-integer input is refused rather than rounded, since at
 * this layer it means the caller has already lost precision upstream.
 */
export function formatCurrency(
  minorUnits: number | null | undefined,
  { locale, currency, placeholder = DEFAULT_PLACEHOLDER }: NajmFormatConfig,
): string {
  if (!currency) {
    throw new Error(
      "formatCurrency requires a `currency`. Set it on NajmFormatProvider or pass it here.",
    );
  }
  if (minorUnits === null || minorUnits === undefined) return placeholder;
  if (!Number.isSafeInteger(minorUnits)) return placeholder;

  return numberFormat(locale, {
    style: "currency",
    currency,
  }).format(minorUnits / minorUnitScale(locale, currency));
}

export function formatNumber(
  value: number | null | undefined,
  { locale, placeholder = DEFAULT_PLACEHOLDER }: NajmFormatConfig,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return placeholder;
  }
  return numberFormat(locale, options).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  config: NajmFormatConfig,
  fractionDigits = 0,
): string {
  return formatNumber(value, config, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatDate(
  value: Date | number | string | null | undefined,
  {
    locale,
    timeZone,
    placeholder = DEFAULT_PLACEHOLDER,
  }: NajmFormatConfig,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  if (isBlank(value)) return placeholder;
  const date = toDate(value as Date | number | string);
  if (!date) return placeholder;

  return dateFormat(locale, { ...options, timeZone }).format(date);
}

export function formatDateTime(
  value: Date | number | string | null | undefined,
  config: NajmFormatConfig,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  },
): string {
  return formatDate(value, config, options);
}

export function formatTime(
  value: Date | number | string | null | undefined,
  config: NajmFormatConfig,
): string {
  return formatDate(value, config, { timeStyle: "short" });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

/**
 * Renders a timestamp as distance from now — "3 days ago", "in 2 hours".
 *
 * Time zone is not a parameter: an elapsed duration is the same in every zone.
 */
export function formatRelativeTime(
  value: Date | number | string | null | undefined,
  { locale, placeholder = DEFAULT_PLACEHOLDER }: NajmFormatConfig,
  now: Date | number = Date.now(),
): string {
  if (isBlank(value)) return placeholder;
  const date = toDate(value as Date | number | string);
  if (!date) return placeholder;

  const elapsed =
    date.getTime() - (now instanceof Date ? now.getTime() : now);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return format.format(Math.trunc(elapsed / ms), unit);
    }
  }
  return format.format(0, "second");
}

/**
 * Turns a machine token into readable text: `out_for_delivery` → `Out For
 * Delivery`.
 *
 * The fallback for a value with no catalog entry, not a substitute for one.
 * Anything user-visible and known in advance belongs in the translations.
 */
export function humanizeToken(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Today as `YYYY-MM-DD` in the host's zone, for `<input type="date">`.
 *
 * Not `toISOString().slice(0, 10)`, which is the same line everyone writes and
 * is wrong west of UTC for the first hours of the day: it converts to UTC
 * first, so a date picker in Casablanca opens on tomorrow. The parts are read
 * off the local calendar instead.
 *
 * Deliberately host-zone rather than preference-zone. This produces the value a
 * date *input* round-trips, and that control is bound to the machine the user
 * is typing on; `formatDate` is what renders a date for reading.
 */
export function localDateInput(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface SlugifyOptions {
  /** Uppercases the result, for an identifier conventionally read in caps. */
  upperCase?: boolean;
  /** Longest slug produced, before the case change. Defaults to 160. */
  maxLength?: number;
}

/**
 * Turns a label into a URL- and identifier-safe token: `Épicerie Fine` →
 * `epicerie-fine`.
 *
 * Accents are folded rather than dropped. Stripping them outright is the usual
 * one-liner and it silently eats letters — `Épicerie` becomes `picerie` — which
 * is a poor slug in exactly the languages most likely to need one.
 *
 * A value with nothing to transliterate — Arabic or CJK, where folding has no
 * ASCII to fall back to — yields a random token rather than an empty string.
 * Empty is never a usable slug, and returning one pushes the failure to a
 * uniqueness constraint far from the cause.
 */
export function slugify(
  value: string,
  { upperCase = false, maxLength = 160 }: SlugifyOptions = {},
): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);

  const slug = normalized || crypto.randomUUID().slice(0, 8);
  return upperCase ? slug.toUpperCase() : slug;
}
