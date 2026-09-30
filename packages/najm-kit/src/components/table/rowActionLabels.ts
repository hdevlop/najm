import React from "react";

import { TableStoreContext } from "./TableContext";
import { useResolvedToolbarLabels } from "./TableDefaults";
import type { NTableToolbarLabels } from "./toolbarContract";

/** The row-action copy with the packaged English applied per field. */
export function rowActionCopy(labels: NTableToolbarLabels) {
  return {
    rowActions: labels.rowActions ?? "Row actions",
    rowView: labels.rowView ?? "View",
    rowEdit: labels.rowEdit ?? "Edit",
    rowDelete: labels.rowDelete ?? "Delete",
    actionsColumn: labels.actionsColumn ?? "Actions",
  };
}

const noSubscription = () => () => {};

/**
 * Inside an NTable its own labels win over the provider's. `NDataCardShell` is
 * public and may render outside one, where `useTableStore` would throw, so the
 * store is read only when present.
 */
export function useRowActionCopy() {
  const store = React.useContext(TableStoreContext);
  const own = React.useSyncExternalStore(
    store ? store.subscribe : noSubscription,
    () => store?.getState().toolbarLabels,
    () => store?.getState().toolbarLabels,
  );
  const labels = useResolvedToolbarLabels(own);
  return React.useMemo(() => rowActionCopy(labels), [labels]);
}
