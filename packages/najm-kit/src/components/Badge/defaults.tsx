import * as React from "react";

import type { NajmTranslate } from "../../providers/paginationLabels";
import type { BadgeColor, BadgeIcon, BadgeShape, BadgeSize, NBadgeLook } from "./Badge";
import { normalizeStatusToken } from "./status";

/**
 * Application-wide presentation policy for `<NBadge status="…" />`.
 *
 * This is the whole reason a project ends up with a `StatusBadge` wrapper: the
 * badge itself is already correct, but every call site has to repeat the same
 * look, the same shape, and the same translation lookup. Declared once on the
 * provider, none of that reaches a call site.
 *
 * What stays in the application: the vocabulary and the catalog. `statusMap`
 * and `statusLabelKeys` take *its* status tokens and *its* catalog keys — this
 * package ships neither.
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
  children,
}: NBadgeDefaultsProviderProps) {
  const value = React.useMemo<NBadgeDefaultsContextValue>(
    () => ({ defaults, t }),
    [defaults, t],
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
 * The provider's label for a status, or `undefined` when it claims none.
 *
 * A finished string in `statusLabels` wins over a catalog key: it is the more
 * specific answer, and an application supplying both for one status means the
 * literal. A key with no translator available resolves to nothing rather than
 * rendering the key itself — the caller falls through to humanizing the token,
 * which is wrong-looking text instead of debug text.
 */
export function resolveBadgeStatusLabel(
  status: string,
  defaults: NBadgeDefaults | undefined,
  t: NajmTranslate | undefined,
): string | undefined {
  if (!defaults) return undefined;
  const normalized = normalizeStatusToken(status);

  const literal =
    defaults.statusLabels?.[status] ?? defaults.statusLabels?.[normalized];
  if (literal !== undefined) return literal;

  const key =
    defaults.statusLabelKeys?.[status] ?? defaults.statusLabelKeys?.[normalized];
  return key !== undefined && t ? t(key) : undefined;
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
