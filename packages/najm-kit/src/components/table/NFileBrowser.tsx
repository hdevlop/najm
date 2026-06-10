import React, { useCallback, useMemo } from "react";
import type { ColumnDef, Row, SortingState } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { NTable } from "./NTable";
import { NTableCardRoot } from "./NTableCardRoot";
import { Badge } from "../Badge";
import { NFileTypeIcon, NFolderIcon } from "../data-display/NFileTypeIcon";
import { cn } from "../../lib/cn";

export interface FileNode {
  key: string;
  name: string;
  isFolder: boolean;
  mimeType?: string;
  size?: number;
  updatedAt?: string;
  meta?: Record<string, unknown>;
}

export type FileBrowserMode = "table" | "cards";

export interface NFileBrowserRenderThumbProps {
  node: FileNode;
  size: "sm" | "xl";
}

export interface NFileBrowserCardProps {
  data: FileNode;
  row: Row<FileNode>;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export interface NFileBrowserProps {
  nodes: FileNode[];
  mode?: FileBrowserMode;
  defaultMode?: FileBrowserMode;
  onModeChange?: (mode: FileBrowserMode) => void;
  availableModes?: readonly FileBrowserMode[];

  onOpen?: (node: FileNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: FileNode) => void;
  onBackgroundContextMenu?: (e: React.MouseEvent) => void;

  selected?: Set<string> | string[];
  onSelectionChange?: (keys: string[]) => void;

  renderThumb?: (props: NFileBrowserRenderThumbProps) => React.ReactNode;
  renderCard?: (props: NFileBrowserCardProps) => React.ReactNode;

  columns?: ColumnDef<FileNode>[];
  extraColumns?: ColumnDef<FileNode>[];

  showSize?: boolean;
  showType?: boolean;
  showModified?: boolean;

  loading?: boolean;
  sorting?: SortingState;
  onSortingChange?: (state: SortingState) => void;
  showCheckbox?: boolean;
  showPagination?: boolean;
  showViewToggle?: boolean;
  responsiveCards?: boolean;
  noDataText?: string;
  loadingText?: string;
  renderEmpty?: () => React.ReactNode;
  renderToolbar?: () => React.ReactNode;
  className?: string;
}

export function formatFileBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatFileRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

const defaultRenderThumb = ({ node, size }: NFileBrowserRenderThumbProps): React.ReactNode =>
  node.isFolder
    ? <NFolderIcon size={size} />
    : <NFileTypeIcon mimeType={node.mimeType} fileName={node.name} size={size} />;

export interface BuildDefaultFileColumnsOptions {
  renderThumb?: (props: NFileBrowserRenderThumbProps) => React.ReactNode;
  showType?: boolean;
  showSize?: boolean;
  showModified?: boolean;
}

export function buildDefaultFileColumns(
  options: BuildDefaultFileColumnsOptions = {}
): ColumnDef<FileNode>[] {
  const {
    renderThumb = defaultRenderThumb,
    showType = true,
    showSize = true,
    showModified = true,
  } = options;

  const cols: ColumnDef<FileNode>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const node = row.original;
        return (
          <div className="flex items-center gap-2">
            {renderThumb({ node, size: "sm" })}
            <span className="font-medium text-txt">{node.name}</span>
          </div>
        );
      },
    },
  ];
  if (showType) {
    cols.push({
      accessorKey: "mimeType",
      header: "Type",
      cell: ({ row }) => {
        const node = row.original;
        return (
          <Badge variant="outline" className="text-[10px] font-normal">
            {node.isFolder ? "Folder" : (node.mimeType?.split("/")[1] ?? "File").toUpperCase()}
          </Badge>
        );
      },
    });
  }
  if (showSize) {
    cols.push({
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => {
        const node = row.original;
        return (
          <span className="block text-right text-txt-muted">
            {node.isFolder ? "-" : formatFileBytes(node.size ?? 0)}
          </span>
        );
      },
    });
  }
  if (showModified) {
    cols.push({
      accessorKey: "updatedAt",
      header: "Modified",
      cell: ({ row }) => {
        const node = row.original;
        return (
          <span className="flex items-center gap-1 text-txt-muted">
            <Clock size={12} />
            {node.isFolder || !node.updatedAt ? "-" : formatFileRelative(node.updatedAt)}
          </span>
        );
      },
    });
  }
  return cols;
}

function DefaultFileTile({
  data,
  row,
  onClick,
  onContextMenu,
  renderThumb,
}: NFileBrowserCardProps & { renderThumb: (p: NFileBrowserRenderThumbProps) => React.ReactNode }) {
  const isSel = row.getIsSelected();
  return (
    <NTableCardRoot
      card={{ onClick, onContextMenu }}
      className={cn(
        "group relative flex w-36 cursor-pointer flex-col items-center justify-start gap-2 rounded-xl border border-transparent p-4 transition-colors",
        "hover:bg-bg-elev-1 hover:border-white/10",
        isSel && "bg-brand/10 border-brand/40"
      )}
    >
      <div className="relative flex h-20 w-20 items-end justify-center">
        {renderThumb({ node: data, size: "xl" })}
        <input
          type="checkbox"
          checked={isSel}
          onChange={(e) => { e.stopPropagation(); row.toggleSelected(!!e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-0 top-0 rounded border-white/20 bg-bg transition-opacity",
            isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          aria-label={`Select ${data.name}`}
        />
      </div>
      <div className="flex w-full flex-col items-center text-center">
        <span className="max-w-full truncate text-xs font-semibold text-txt">{data.name}</span>
        <span className="mt-0.5 text-[10px] text-txt-muted">
          {data.isFolder ? "Folder" : formatFileBytes(data.size ?? 0)}
        </span>
      </div>
    </NTableCardRoot>
  );
}

export function NFileBrowser({
  nodes,
  mode,
  defaultMode = "table",
  onModeChange,
  availableModes = ["table", "cards"],
  onOpen,
  onContextMenu,
  onBackgroundContextMenu,
  selected,
  onSelectionChange,
  renderThumb = defaultRenderThumb,
  renderCard,
  columns,
  extraColumns,
  showSize = true,
  showType = true,
  showModified = true,
  loading,
  sorting,
  onSortingChange,
  showCheckbox,
  showPagination = false,
  showViewToggle = true,
  responsiveCards = false,
  noDataText = "No files or folders",
  loadingText,
  renderEmpty,
  renderToolbar,
  className,
}: NFileBrowserProps) {
  const defaultColumns = useMemo<ColumnDef<FileNode>[]>(
    () => buildDefaultFileColumns({ renderThumb, showType, showSize, showModified }),
    [renderThumb, showType, showSize, showModified]
  );

  const resolvedColumns = useMemo<ColumnDef<FileNode>[]>(
    () => columns ?? [...defaultColumns, ...(extraColumns ?? [])],
    [columns, defaultColumns, extraColumns]
  );

  const rowSelection = useMemo(() => {
    if (!selected) return undefined;
    const keys = Array.isArray(selected) ? selected : Array.from(selected);
    return Object.fromEntries(keys.map((k) => [k, true]));
  }, [selected]);

  const CardComponent = useMemo(() => {
    if (renderCard) return renderCard as React.ComponentType<NFileBrowserCardProps>;
    return ((props: NFileBrowserCardProps) => (
      <DefaultFileTile {...props} renderThumb={renderThumb} />
    )) as React.ComponentType<NFileBrowserCardProps>;
  }, [renderCard, renderThumb]);

  const handleRowClick = useCallback((node: FileNode) => {
    onOpen?.(node);
  }, [onOpen]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    onContextMenu?.(e, node);
  }, [onContextMenu]);

  const effectiveMode = mode ?? defaultMode;
  const effectiveShowCheckbox = showCheckbox ?? (effectiveMode === "table");

  return (
    <div
      className={cn("flex h-full w-full flex-col", className)}
      onContextMenu={(e) => {
        if (!onBackgroundContextMenu) return;
        if ((e.target as HTMLElement).closest("[data-row]")) return;
        onBackgroundContextMenu(e);
      }}
    >
      <NTable<FileNode>
        data={nodes}
        columns={resolvedColumns}
        getRowId={(r) => r.key}
        mode={mode}
        defaultMode={defaultMode}
        onModeChange={onModeChange}
        availableModes={availableModes}
        responsiveCards={responsiveCards}
        dynamicHeight={false}
        showColumnVisibility={false}
        showPagination={showPagination}
        showViewToggle={showViewToggle}
        loading={loading}
        sorting={sorting}
        onSortingChange={onSortingChange}
        renderToolbar={renderToolbar}
        renderCard={CardComponent}
        rowSelection={rowSelection}
        onRowSelectionChange={(next) => {
          if (!onSelectionChange) return;
          const keys = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
          onSelectionChange(keys);
        }}
        onRowClick={handleRowClick}
        onRowContextMenu={handleRowContextMenu}
        showCheckbox={effectiveShowCheckbox}
        noDataText={noDataText}
        loadingText={loadingText}
        renderEmpty={renderEmpty}
        className="h-full"
      />
    </div>
  );
}
