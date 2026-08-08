import * as React from "react";

import { useNajmPreferencesContext } from "../providers/preferences";
import {
  DEFAULT_PLACEHOLDER,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  humanizeToken,
} from "./format";
import type { NajmFormatConfig } from "./format";

export interface NajmFormatContextValue extends Required<
  Pick<NajmFormatConfig, "locale" | "timeZone" | "placeholder">
> {
  currency?: string;
  /** Formats an integer count of minor units as `currency`. */
  money: (minorUnits: number | null | undefined) => string;
  number: (
    value: number | null | undefined,
    options?: Intl.NumberFormatOptions,
  ) => string;
  percent: (value: number | null | undefined, fractionDigits?: number) => string;
  date: (
    value: Date | number | string | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  dateTime: (value: Date | number | string | null | undefined) => string;
  time: (value: Date | number | string | null | undefined) => string;
  relativeTime: (value: Date | number | string | null | undefined) => string;
  humanize: (value: string) => string;
  /** The resolved inputs, for handing to the pure functions directly. */
  config: NajmFormatConfig;
}

const NajmFormatContext = React.createContext<NajmFormatContextValue | null>(
  null,
);

export interface NajmFormatProviderProps {
  children: React.ReactNode;
  /**
   * BCP 47 tag. `NajmAppProvider` derives this from the active `najm-i18n`
   * language, so applications using it rarely pass this by hand.
   */
  locale: string;
  /**
   * ISO 4217 code for `money`. Omitted means the application does not format
   * currency; calling `money` without it throws rather than guessing a symbol.
   */
  currency?: string;
  /**
   * Overrides the time zone from `NajmPreferencesProvider`.
   *
   * Reading preferences is the point — it is where the user's choice already
   * lives, and formatting dates against anything else is how a table ends up
   * disagreeing with the picker that set it.
   */
  timeZone?: string;
  /** Rendered for absent values. Defaults to an em dash. */
  placeholder?: string;
}

/**
 * Binds the formatters to the live locale and time zone.
 *
 * The time zone comes from `NajmPreferencesProvider` when one is mounted, which
 * is what makes this worth a provider rather than a helper import: the
 * preference and the rendering of every date derived from it stay in one place,
 * and a zone change re-renders the consumers instead of leaving stale text.
 */
export function NajmFormatProvider({
  children,
  locale,
  currency,
  timeZone,
  placeholder = DEFAULT_PLACEHOLDER,
}: NajmFormatProviderProps) {
  const preferences = useNajmPreferencesContext();
  const resolvedTimeZone =
    timeZone ??
    preferences?.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  const value = React.useMemo<NajmFormatContextValue>(() => {
    const config: NajmFormatConfig = {
      locale,
      timeZone: resolvedTimeZone,
      currency,
      placeholder,
    };

    return {
      locale,
      timeZone: resolvedTimeZone,
      currency,
      placeholder,
      config,
      money: (minorUnits) => formatCurrency(minorUnits, config),
      number: (value_, options) => formatNumber(value_, config, options),
      percent: (value_, digits) => formatPercent(value_, config, digits),
      date: (value_, options) => formatDate(value_, config, options),
      dateTime: (value_) => formatDateTime(value_, config),
      time: (value_) => formatTime(value_, config),
      relativeTime: (value_) => formatRelativeTime(value_, config),
      humanize: humanizeToken,
    };
  }, [locale, resolvedTimeZone, currency, placeholder]);

  return (
    <NajmFormatContext.Provider value={value}>
      {children}
    </NajmFormatContext.Provider>
  );
}

/** Returns the context when one is mounted, or `null`. */
export function useNajmFormatContext(): NajmFormatContextValue | null {
  return React.useContext(NajmFormatContext);
}

/**
 * The bound formatters.
 *
 * ```tsx
 * const fmt = useNajmFormat();
 * fmt.money(order.totalMinor); // "1 250,00 MAD"
 * fmt.date(order.createdAt);   // "8 août 2026"
 * ```
 */
export function useNajmFormat(): NajmFormatContextValue {
  const value = React.useContext(NajmFormatContext);
  if (!value) {
    throw new Error(
      "useNajmFormat must be rendered under a NajmFormatProvider or NajmAppProvider.",
    );
  }
  return value;
}
