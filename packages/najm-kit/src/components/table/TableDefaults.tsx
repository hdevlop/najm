import React from "react";

import type { NTablePaginationLabels } from "./paginationContract";

/**
 * Defaults every `NTable` beneath the provider inherits.
 *
 * Localized copy is the motivating case: an application with more than a couple
 * of tables should not repeat the same label bundle at every render site, and
 * an application with more than one locale should not have to remember to.
 */
export interface NTableDefaults {
  paginationLabels?: NTablePaginationLabels;
}

const NTableDefaultsContext = React.createContext<NTableDefaults>({});

/**
 * Supply table defaults to everything below.
 *
 * `value` is passed straight through, so memoize it in the caller — an inline
 * object literal rebuilds on every render of the shell and re-renders every
 * table beneath it. Most label fields are functions, so `useMemo` on the
 * translator is usually the whole job.
 */
export function NTableDefaultsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: NTableDefaults;
}) {
  return (
    <NTableDefaultsContext.Provider value={value}>
      {children}
    </NTableDefaultsContext.Provider>
  );
}

export function useNTableDefaults(): NTableDefaults {
  return React.useContext(NTableDefaultsContext);
}

/**
 * Per-key merge, most specific first.
 *
 * A table that overrides one label keeps the provider's other nine, and a label
 * the application never supplies still falls back to the packaged English.
 */
export function useResolvedPaginationLabels(
  own: NTablePaginationLabels | undefined,
): NTablePaginationLabels {
  const defaults = useNTableDefaults();
  const inherited = defaults.paginationLabels;

  return React.useMemo(
    () => ({ ...inherited, ...own }),
    [inherited, own],
  );
}
