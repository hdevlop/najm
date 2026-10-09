import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { flexRender, type Cell, type Table } from "@tanstack/react-table";
import { useCardViewport } from "../../hooks/useMediaQuery";
import { NScrollContinuation } from "./NScrollContinuation";
import { useTableStore } from "./TableContext";
import { EditableCell } from "./NTableContent";
import type { NTableColumnMeta } from "./responsiveColumns";
import type { NTableProps, NTableState } from "./NTable";

/** Rows revealed per step of a mobile list. */
export const MOBILE_LIST_BATCH_SIZE = 12;

type CardProps = React.ComponentProps<NonNullable<NTableProps["renderCard"]>>;

const MobileListContext = createContext<{
  renderCard?: NTableProps["renderCard"];
  loadMore: () => void;
}>({ loadMore: () => {} });

function columnLabel(cell: Cell<any, unknown>) {
  const header = cell.column.columnDef.header;
  return typeof header === "string" ? header : cell.column.id;
}

/** One cell of a card, editable in place when its column is. */
function NTableCardCell({ cell }: { cell: Cell<any, unknown> }) {
  const onCellEdit = useTableStore.use.onCellEdit();
  const meta = cell.column.columnDef.meta as NTableColumnMeta | undefined;
  const editable = Boolean(onCellEdit) && (
    typeof meta?.editable === "function" ? Boolean(meta.editable(cell.row.original)) : Boolean(meta?.editable)
  );
  if (editable && onCellEdit) return <EditableCell cell={cell} onCellEdit={onCellEdit} />;
  return <>{flexRender(cell.column.columnDef.cell, cell.getContext())}</>;
}

/**
 * The card a table without `renderCard` gets on a phone: each visible column
 * as a label and its value, so no column is lost to the narrow screen.
 */
export function NTableCellCard({ row }: CardProps) {
  return (
    <dl data-ntable-cell-card className="flex min-w-0 flex-col gap-2 pe-6">
      {row.getVisibleCells().filter((cell) => cell.column.id !== "actions").map((cell) => (
        <div key={cell.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">{columnLabel(cell)}</dt>
          <dd className="min-w-0 break-words text-sm">
            <NTableCardCell cell={cell} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MobileListCard(props: CardProps) {
  const { renderCard: Card = NTableCellCard, loadMore } = useContext(MobileListContext);
  const table = useTableStore.use.table() as Table<unknown>;
  const rows = table.getRowModel().rows;
  const hasMore = table.getPrePaginationRowModel().rows.length > rows.length;
  const isLast = rows.at(-1)?.id === props.row.id;

  return (
    <>
      <Card {...props} />
      {hasMore && isLast ? <NScrollContinuation loadMore={loadMore} rowCount={rows.length} /> : null}
    </>
  );
}

/**
 * The props a mobile list hands NTable: cards only, the first `count` rows of
 * the full, filtered and sorted row model, no page bar and no view toggle.
 * Server-paged tables and the JSON and files views are left as they are.
 */
export function mobileListPresentation<T>(props: NTableProps<T>, cardViewport: boolean, count: number): NTableProps<T> {
  if (!cardViewport || props.manualPagination || props.mode === "json" || props.mode === "files") return props;
  return {
    ...props,
    mode: "cards",
    availableModes: ["cards"],
    renderCard: MobileListCard as NTableProps<T>["renderCard"],
    pagination: { pageIndex: 0, pageSize: count },
    cardPagination: { mode: "paged" },
    onPaginationChange: undefined,
    dynamicHeight: false,
    showPagination: false,
    showViewToggle: false,
  };
}

/**
 * NTable with `mobileList`. Below `lg` the whole table becomes one card list
 * that reveals more rows as the page scrolls. It keeps NTable's full row
 * model, so filters, sorting, selection and data actions still cover every
 * row; only the controlled first page grows.
 */
export function NTableMobileList<T>({ props, Base }: {
  props: NTableProps<T>;
  Base: React.ComponentType<NTableProps<T>>;
}) {
  const cardViewport = useCardViewport();
  const { data, getRowId, sorting, defaultSorting, onStateChange } = props;
  // A refetch or an inline edit can replace the array without changing the
  // list. Start over only when the rows or their order change, so an edit
  // keeps the rows already revealed.
  const source = useMemo(() => JSON.stringify(data.map((row, index) =>
    getRowId?.(row) ?? (row as { id?: string })?.id ?? index,
  )), [data, getRowId]);
  const [batch, setBatch] = useState({ source, count: MOBILE_LIST_BATCH_SIZE });
  const count = batch.source === source ? batch.count : MOBILE_LIST_BATCH_SIZE;
  const refinement = useRef(JSON.stringify([sorting ?? defaultSorting ?? [], [], ""]));

  const loadMore = useCallback(() => {
    setBatch((current) => ({
      source,
      count: (current.source === source ? current.count : MOBILE_LIST_BATCH_SIZE) + MOBILE_LIST_BATCH_SIZE,
    }));
  }, [source]);

  // A new sort, filter or search starts again from the first batch.
  const handleStateChange = useCallback((state: NTableState) => {
    const next = JSON.stringify([sorting ?? state.sorting, state.columnFilters, state.globalFilter]);
    if (next !== refinement.current) {
      refinement.current = next;
      setBatch({ source, count: MOBILE_LIST_BATCH_SIZE });
    }
    onStateChange?.(state);
  }, [source, sorting, onStateChange]);

  const context = useMemo(() => ({ renderCard: props.renderCard, loadMore }), [props.renderCard, loadMore]);

  return (
    <MobileListContext.Provider value={context}>
      <Base {...mobileListPresentation(props, cardViewport, count)} onStateChange={handleStateChange} />
    </MobileListContext.Provider>
  );
}
