import * as React from "react";

import type { NajmTranslate } from "../../providers/paginationLabels";
import type { BadgeColor, BadgeIcon, BadgeShape, BadgeSize, NBadgeLook } from "./Badge";
import { findStatusLabel } from "./statusLabels";

/**
 * Application-wide presentation policy for `<NBadge status="…" />`.
 *
 * This is the whole reason a project ends up with a `StatusBadge` wrapper: the
 * badge itself is already correct, but every call site has to repeat the same
 * look, the same shape, and the same translation lookup. Declared once on the
 * provider, none of that reaches a call site.
 *
 * What stays in the application: what it does *differently*. The packaged
 * vocabulary, its four-language labels, and the conventional `status.<token>`
 * catalog lookup already cover the common statuses, so `statusMap` and
 * `statusLabelKeys` are for the tokens and keys that are genuinely this
 * application’s own.
 */
export interface NBadgeDefaults {
  look?: NBadgeLook;
  shape?: BadgeShape;
  size?: BadgeSize;
  showIcon?: boolean;
  /** Status token to badge color. Merged over the packaged vocabulary. */
  statusMap?: Record<string, BadgeColor>;
  /** Badge color to icon, used when `showIcon` is on. */
  iconMap?: Record<string, BadgeIcon>;
  /** Status token to finished label text. Wins over `statusLabelKeys`. */
  statusLabels?: Record<string, string>;
  /** Status token to catalog key, resolved through the provider's `t`. */
  statusLabelKeys?: Record<string, string>;
  /**
   * Catalog prefix for the conventional lookup. Defaults to `"status"`.
   *
   * Set it to `""` to switch the convention off entirely, for an application
   * whose catalog happens to hold an unrelated `status.*` branch.
   */
  statusKeyPrefix?: string;
}

export interface NBadgeDefaultsContextValue {
  defaults?: NBadgeDefaults;
  /**
   * The provider's translator, used for `statusLabelKeys`.
   *
   * Held here rather than looked up separately so a language change reaches the
   * badges: the application's `t` gets a new identity, this value is rebuilt,
   * and every badge below recomputes its label without remounting.
   */
  t?: NajmTranslate;
  /**
   * Active language, for the packaged labels.
   *
   * Supplied by `NajmKitProvider` from the mounted i18n provider; an
   * application mounting `NajmUIProvider` itself passes it beside `t`. Omitted,
   * the packaged labels resolve to English.
   */
  language?: string;
}

const NBadgeDefaultsContext =
  React.createContext<NBadgeDefaultsContextValue | null>(null);

export interface NBadgeDefaultsProviderProps extends NBadgeDefaultsContextValue {
  children: React.ReactNode;
}

/**
 * Publishes badge status defaults to the tree.
 *
 * Mounted by `NajmUIProvider` from its `badgeDefaults` prop; there is no global
 * registry, so two provider trees on one page keep their own policies.
 */
export function NBadgeDefaultsProvider({
  defaults,
  t,
  language,
  children,
}: NBadgeDefaultsProviderProps) {
  const value = React.useMemo<NBadgeDefaultsContextValue>(
    () => ({ defaults, t, language }),
    [defaults, t, language],
  );

  return (
    <NBadgeDefaultsContext.Provider value={value}>
      {children}
    </NBadgeDefaultsContext.Provider>
  );
}

/** The ambient badge policy, or `null` outside a provider. */
export function useNBadgeDefaults(): NBadgeDefaultsContextValue | null {
  return React.useContext(NBadgeDefaultsContext);
}

/**
 * The label for a status: the application's, then the packaged one.
 *
 * A finished string in `statusLabels` wins over a catalog key: it is the more
 * specific answer, and an application supplying both for one status means the
 * literal. Behind those, the conventional `status.<token>` catalog entry, then
 * the packaged label for the active language.
 *
 * Returns `undefined` only when nothing claims the token at all, so the caller
 * humanizes it. A catalog key that resolves to nothing never renders as itself
 * — debug text in an interface is worse than an English default.
 */
export function resolveBadgeStatusLabel(
  status: string,
  defaults: NBadgeDefaults | undefined,
  t: NajmTranslate | undefined,
  language?: string,
): string | undefined {
  return findStatusLabel(status, {
    language,
    labels: defaults?.statusLabels,
    labelKeys: defaults?.statusLabelKeys,
    keyPrefix: defaults?.statusKeyPrefix,
    t,
  });
}

/**
 * Provider map underneath, per-instance entries on top.
 *
 * Merged rather than replaced so overriding one status costs one status, which
 * is the same rule `statusMap` already follows against the packaged vocabulary.
 */
export function mergeBadgeMaps<Value>(
  base: Record<string, Value> | undefined,
  overrides: Record<string, Value> | undefined,
): Record<string, Value> | undefined {
  if (!base) return overrides;
  if (!overrides) return base;
  return { ...base, ...overrides };
}
