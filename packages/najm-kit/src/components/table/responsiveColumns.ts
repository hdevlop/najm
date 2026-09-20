import type { ColumnDef } from "@tanstack/react-table";
import type { NajmResponsiveBreakpoint } from "../../theme/design-types";

export type NTableColumnBreakpoint = Exclude<NajmResponsiveBreakpoint, "base">;

export type NTableEditorType = "text" | "number" | "select" | "checkbox" | "textarea";

export interface NTableEditorOption<TValue = any> {
  value: TValue;
  label: string;
}

type NTableEditorResolver<TData, TValue> = TValue | ((row: TData) => TValue);

export interface NTableColumnMeta<TData = any, TValue = any> {
  /**
   * Whether this column is eligible to exist in NTable.
   * Defaults to true. Set from the application's role/capability decision.
   */
  visible?: boolean;
  /**
   * Hide this table column below the selected Tailwind breakpoint.
   * The column remains visible at that breakpoint and above.
   * Applies to table view only.
   */
  hiddenBelow?: NTableColumnBreakpoint;
  /** Whether this cell can be edited. A function can decide per row. */
  editable?: boolean | ((row: TData) => boolean);
  /** Input presented while the cell is being edited. Defaults to `text`. */
  editor?: NTableEditorType;
  /** Choices for a select editor. A function can derive them from the row. */
  options?: NTableEditorResolver<TData, ReadonlyArray<NTableEditorOption<TValue>>>;
  /** Return an error message to keep the editor open and reject the value. */
  validate?: (value: TValue, row: TData) => string | null | undefined;
  /** Numeric editor minimum. A function can derive it from the row. */
  min?: NTableEditorResolver<TData, number | undefined>;
  /** Numeric editor maximum. A function can derive it from the row. */
  max?: NTableEditorResolver<TData, number | undefined>;
  /** Numeric editor step. Defaults to `any`. */
  step?: number | string;
}

/** TanStack `ColumnDef` plus Najm's responsive and inline-editing metadata. */
export type NTableColumnDef<TData, TValue = any> = ColumnDef<TData, TValue> & {
  meta?: ColumnDef<TData, TValue>["meta"] & NTableColumnMeta<TData, TValue>;
};

const HIDDEN_BELOW_CLASSES = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const satisfies Record<NTableColumnBreakpoint, string>;

export function resolveHiddenBelowClass(
  hiddenBelow: NTableColumnBreakpoint | undefined,
): string | undefined {
  if (!hiddenBelow) return undefined;
  return HIDDEN_BELOW_CLASSES[hiddenBelow];
}

export const hiddenBelowClasses: Readonly<Record<NTableColumnBreakpoint, string>> =
  HIDDEN_BELOW_CLASSES;

function readMeta<TData, TValue>(column: ColumnDef<TData, TValue>): NTableColumnMeta | undefined {
  return (column.meta as NTableColumnMeta | undefined) ?? undefined;
}

function isGroupedColumn<TData, TValue>(column: ColumnDef<TData, TValue>): boolean {
  return Array.isArray((column as { columns?: unknown[] }).columns);
}

function getColumnId<TData, TValue>(column: ColumnDef<TData, TValue>, fallback: string): string {
  const id = (column as { id?: string }).id;
  if (typeof id === "string" && id.length > 0) return id;
  const accessorKey = (column as { accessorKey?: string }).accessorKey;
  if (typeof accessorKey === "string" && accessorKey.length > 0) return accessorKey;
  return fallback;
}

/**
 * Returns the effective columns for TanStack + the loading skeleton + the
 * column visibility menu. Capability-gated columns (`meta.visible === false`)
 * are removed without mutating the input. Grouped columns are filtered
 * recursively; groups with no eligible children are removed.
 *
 * The helper is pure: it never mutates the caller's column definitions.
 */
export function filterResponsiveColumns<TData, TValue>(
  columns: ReadonlyArray<ColumnDef<TData, TValue>>,
): ColumnDef<TData, TValue>[] {
  const result: ColumnDef<TData, TValue>[] = [];
  for (const column of columns) {
    if (isGroupedColumn(column)) {
      const childDefs = (column as { columns?: ColumnDef<TData, TValue>[] }).columns ?? [];
      const filteredChildren = filterResponsiveColumns(childDefs);
      const groupMeta = readMeta(column);
      if (groupMeta?.visible === false) continue;
      if (filteredChildren.length === 0) continue;
      const { columns: _ignored, ...rest } = column as ColumnDef<TData, TValue> & {
        columns?: ColumnDef<TData, TValue>[];
      };
      result.push({ ...rest, columns: filteredChildren } as ColumnDef<TData, TValue>);
      continue;
    }
    const meta = readMeta(column);
    if (meta?.visible === false) continue;
    result.push(column);
  }
  return result;
}

export function getColumnResponsiveKey<TData, TValue>(
  column: ColumnDef<TData, TValue>,
  index: number,
): string {
  return getColumnId(column, `col-${index}`);
}
