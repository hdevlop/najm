import * as React from "react";

import { NajmDesignProvider } from "../theme/design-provider";
import type { NajmDesignConfig } from "../theme/design-types";
// Imported from the module rather than the `components/table` barrel: this file
// is reachable from the `najm-kit/next` entry, and the barrel pulls NTable and
// its dependencies into that bundle for the sake of one context provider.
import { NTableDefaultsProvider } from "../components/table/TableDefaults";
import type { NTableDefaults } from "../components/table/TableDefaults";
import {
  NajmPreferencesProvider,
  useNajmPreferencesContext,
  useNajmTheme,
} from "./preferences";
import type { NajmPreferencesProviderProps } from "./preferences";
import {
  buildPaginationLabels,
  DEFAULT_PAGINATION_KEY_PREFIX,
} from "./paginationLabels";
import type { NajmTranslate } from "./paginationLabels";

/**
 * Shared so the identity is stable across renders — `NajmDesignProvider`
 * memoizes on `config.components`, `config.typography` and `config.layout`, and
 * a fresh literal here would invalidate that on every render of the tree.
 */
const EMPTY_DESIGN: NajmDesignConfig = Object.freeze({
  version: 1,
  theme: {},
  components: {},
}) as NajmDesignConfig;

export interface NajmUIProviderProps
  extends Omit<NajmPreferencesProviderProps, "children"> {
  children: React.ReactNode;

  /**
   * The design config handed to `NajmDesignProvider`.
   *
   * Optional, and deliberately so: an application with no runtime theme editor
   * has nothing to put here, and requiring it was the only reason such an
   * application still had to author a provider file just to hold a constant.
   */
  design?: NajmDesignConfig;
  /** Forwarded to `NajmDesignProvider`. */
  className?: string;

  /**
   * Translator for the pagination labels. Omit it and the packaged English
   * applies — the provider is still worth mounting for design and preferences.
   *
   * Memoize it. The labels are rebuilt whenever its identity changes, and
   * rebuilding them re-renders every table beneath.
   */
  t?: NajmTranslate;
  /** Catalog prefix for the labels. Defaults to `"common.pagination"`. */
  paginationKeyPrefix?: string;
  /**
   * Per-key overrides layered over the translated labels. Memoize it, for the
   * same reason as `t`.
   */
  tableDefaults?: NTableDefaults;
}

type UICoreProps = Pick<
  NajmUIProviderProps,
  | "children"
  | "design"
  | "className"
  | "t"
  | "paginationKeyPrefix"
  | "tableDefaults"
>;

/**
 * Everything below preferences: design (which needs the live theme) and the
 * table defaults derived from the translator.
 *
 * Split out so `NajmUIProvider` can decide whether to mount a preferences
 * provider without making that decision from inside a conditional hook.
 */
function NajmUICore({
  children,
  design = EMPTY_DESIGN,
  className,
  t,
  paginationKeyPrefix = DEFAULT_PAGINATION_KEY_PREFIX,
  tableDefaults,
}: UICoreProps) {
  const { theme } = useNajmTheme();

  const defaults = React.useMemo<NTableDefaults>(() => {
    const translated = t
      ? buildPaginationLabels(t, paginationKeyPrefix)
      : undefined;
    const overrides = tableDefaults?.paginationLabels;

    // Per-key, most specific last, mirroring `useResolvedPaginationLabels`:
    // an explicit override wins, a translated label fills in behind it, and a
    // label neither supplies still reaches the packaged English downstream.
    const paginationLabels =
      translated || overrides ? { ...translated, ...overrides } : undefined;

    return { ...tableDefaults, paginationLabels };
  }, [t, paginationKeyPrefix, tableDefaults]);

  return (
    <NajmDesignProvider config={design} mode={theme} className={className}>
      <NTableDefaultsProvider value={defaults}>
        {children}
      </NTableDefaultsProvider>
    </NajmDesignProvider>
  );
}

/**
 * The one provider a Najm application mounts for UI concerns.
 *
 * Composes three things that otherwise get copied between projects: theme and
 * time zone state with async persistence, a `NajmDesignProvider` fed the live
 * theme, and `NTable` pagination labels derived from the application's
 * translator.
 *
 * What it deliberately does not own: auth, react-query, and the translation
 * catalog. Those stay in the application — folding them in would make a UI
 * package depend on `najm-auth` and `@tanstack/react-query` and turn it into a
 * framework. Persistence is injected as callbacks so this entry imports
 * nothing from `next`; see `NajmNextUIProvider` in `najm-kit/next`.
 *
 * Rendering this under an existing `NajmPreferencesProvider` is supported: the
 * outer one wins and the preference props here are ignored. That is what lets
 * an application with a runtime theme editor hoist preferences above its
 * design context without forking this component.
 */
export function NajmUIProvider({
  children,
  design,
  className,
  t,
  paginationKeyPrefix,
  tableDefaults,
  initialTheme,
  initialTimeZone,
  onThemeChange,
  onTimeZoneChange,
  normalizeTimeZone,
}: NajmUIProviderProps) {
  const outerPreferences = useNajmPreferencesContext();

  const core = (
    <NajmUICore
      design={design}
      className={className}
      t={t}
      paginationKeyPrefix={paginationKeyPrefix}
      tableDefaults={tableDefaults}
    >
      {children}
    </NajmUICore>
  );

  if (outerPreferences) return core;

  return (
    <NajmPreferencesProvider
      initialTheme={initialTheme}
      initialTimeZone={initialTimeZone}
      onThemeChange={onThemeChange}
      onTimeZoneChange={onTimeZoneChange}
      normalizeTimeZone={normalizeTimeZone}
    >
      {core}
    </NajmPreferencesProvider>
  );
}
