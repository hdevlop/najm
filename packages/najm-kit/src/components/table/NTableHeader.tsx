import React from "react";
import { TextInput, SelectInput, ComboboxInput, DateInput } from "../inputs";
import { BaseInput } from "../inputs/BaseInput";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { SlidersHorizontal, List, LayoutGrid, Code, FolderOpen, Plus, Eye, Columns3, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import type { ViewMode } from "./store";
import { HEADER_HEX, type TableHeaderColor } from "./tableColors";

function SearchFilter({ placeholder }: { placeholder?: string }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  if (!table) return null;
  const value = (table.getState().globalFilter as string) ?? "";
  return <TextInput icon={Search} value={value} onChange={(v) => table.setGlobalFilter(v)} placeholder={placeholder ?? "Search…"} bordered={bordered} />;
}

function TextFilter({ name, placeholder }: { name: string; placeholder?: string }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  const column = table?.getColumn?.(name);
  if (!column) return null;
  return <TextInput value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value)} placeholder={placeholder} bordered={bordered} />;
}

function SelectFilter({ name, options, placeholder, inputType }: { name: string; options: any[]; placeholder?: string; inputType?: string }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  const column = table?.getColumn?.(name);
  if (!column) return null;
  const allOptions = [{ value: "__clear__", label: "All" }, ...options.map((o: any) => typeof o === "string" ? { value: o, label: o } : o)];
  const InputComponent = inputType === "combobox" ? ComboboxInput : SelectInput;
  return <InputComponent value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value === "" || value === "__clear__" ? undefined : value)} items={allOptions} placeholder={placeholder || "Filter..."} bordered={bordered} />;
}

function defaultWrapperClass(filter: any) {
  return filter.type === "search" ? "flex-1 min-w-[160px] max-w-sm" : "w-full sm:w-40 shrink-0";
}

function RenderFilter({ filter }: { filter: any }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();

  if (filter.type === "search") {
    return <SearchFilter placeholder={filter.placeholder} />;
  }

  if (filter.type === "date" && typeof filter.onChange === "function") {
    return (
      <DateInput
        value={filter.value ?? ""}
        onChange={filter.onChange}
        placeholder={filter.placeholder}
        bordered={bordered}
        className="w-full"
      />
    );
  }

  if (typeof filter.onChange === "function") {
    if (filter.type === "text" || (!filter.type && typeof filter.value === "string")) {
      return (
        <TextInput
          value={filter.value ?? ""}
          onChange={filter.onChange}
          placeholder={filter.placeholder}
          bordered={bordered}
          className="w-full"
        />
      );
    }
    if (filter.type === "combobox") {
      return (
        <ComboboxInput
          value={filter.value ?? ""}
          onChange={filter.onChange}
          items={filter.options || []}
          placeholder={filter.placeholder}
          searchPlaceholder={filter.searchPlaceholder}
          emptyMessage={filter.emptyMessage}
          icon="filter"
          showIcon
          disabled={filter.disabled}
          bordered={bordered}
          className="w-full"
        />
      );
    }
    return (
      <SelectInput
        value={filter.value ?? ""}
        onChange={filter.onChange}
        items={filter.options || []}
        placeholder={filter.placeholder}
        icon="filter"
        showIcon
        disabled={filter.disabled}
        bordered={bordered}
        className="w-full"
      />
    );
  }

  if (filter.type === "text") {
    return <TextFilter name={filter.name} placeholder={filter.placeholder} />;
  }

  if (!table) return null;
  return <SelectFilter name={filter.name} options={filter.options || []} placeholder={filter.placeholder} inputType={filter.type} />;
}

function TableFilters() {
  const filters = useTableStore.use.filters();
  if (!filters?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
      {filters.map((filter: any) => (
        <div
          key={filter.name}
          className={cn(defaultWrapperClass(filter), filter.className)}
        >
          <RenderFilter filter={filter} />
        </div>
      ))}
    </div>
  );
}

function TableAddButton() {
  const onAddClick = useTableStore.use.onAddClick();
  const showAddButton = useTableStore.use.showAddButton();
  const addButtonText = useTableStore.use.addButtonText();
  const headerColor = useTableStore.use.headerColor() as TableHeaderColor | undefined;
  const bordered = useTableStore.use.bordered();
  if (!showAddButton) return null;

  const accentHex = headerColor ? HEADER_HEX[headerColor] : undefined;
  const btnStyle = accentHex ? { backgroundColor: accentHex } : undefined;
  const baseCls = accentHex ? "hover:opacity-90" : "bg-primary hover:bg-primary/90";
  // Add button is filled — only show a border when consumer explicitly opts in.
  const borderedCls = bordered ? "border border-muted-foreground" : "";

  return (
    <button
      type="button"
      onClick={onAddClick ?? undefined}
      style={btnStyle}
      aria-label={addButtonText || "Create"}
      title={addButtonText || "Create"}
      data-bordered={bordered ? "true" : undefined}
      className={`h-10 w-10 shrink-0 cursor-pointer flex items-center justify-center rounded-lg text-white transition-opacity ${baseCls} ${borderedCls}`}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

function TableSettingsMenu() {
  const showViewToggle = useTableStore.use.showViewToggle();
  const showColumnVisibility = useTableStore.use.showColumnVisibility();
  const availableModes = useTableStore.use.availableModes() as readonly ViewMode[] | undefined;
  const viewMode = useTableStore.use.viewMode() as ViewMode;
  const setViewMode = useTableStore.use.setViewMode();
  const jsonValue = useTableStore.use.jsonValue();
  const renderJson = useTableStore.use.renderJson();
  const cardComponent = useTableStore.use.CardComponent();
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();

  if (!showViewToggle && !showColumnVisibility) return null;

  const allModes: ViewMode[] = ["table", "cards", "json", "files"];
  const filteredModes = availableModes ?? allModes;

  const modeItems: { value: ViewMode; label: string; ariaLabel: string; icon: React.ReactNode }[] = [];
  if (showViewToggle) {
    if (filteredModes.includes("table"))
      modeItems.push({ value: "table", label: "Table", ariaLabel: "Table view", icon: <List className="h-4 w-4" /> });
    if (filteredModes.includes("cards") && cardComponent)
      modeItems.push({ value: "cards", label: "Cards", ariaLabel: "Cards view", icon: <LayoutGrid className="h-4 w-4" /> });
    if (filteredModes.includes("json") && (jsonValue !== undefined || renderJson))
      modeItems.push({ value: "json", label: "JSON", ariaLabel: "JSON view", icon: <Code className="h-4 w-4" /> });
    if (filteredModes.includes("files"))
      modeItems.push({ value: "files", label: "Files", ariaLabel: "Files view", icon: <FolderOpen className="h-4 w-4" /> });
  }

  const columns = table?.getAllColumns?.().filter((c: any) => c.getCanHide()) ?? [];
  const hasModes = modeItems.length > 0;
  const hasColumns = columns.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BaseInput aria-label="Table settings" className="w-auto cursor-pointer px-3" bordered={bordered}>
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
        </BaseInput>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card">
        {showViewToggle && hasModes && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              View
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              {modeItems.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value} aria-label={item.ariaLabel}>
                  {item.icon}
                  <span>{item.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {showViewToggle && hasModes && showColumnVisibility && hasColumns && (
          <DropdownMenuSeparator />
        )}
        {showColumnVisibility && hasColumns && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </DropdownMenuLabel>
            {columns.map((col: any) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(c) => col.toggleVisibility(!!c)}
              >
                <span className="capitalize">{col.id}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


function TableToolbarSlot() {
  const renderToolbar = useTableStore.use.renderToolbar();
  const table = useTableStore.use.table();
  if (!renderToolbar || !table) return null;

  const { sorting, columnFilters, columnVisibility, rowSelection, globalFilter } = table.getState();
  return <>{renderToolbar({ sorting, columnFilters, columnVisibility, rowSelection, globalFilter })}</>;
}

export function NTableHeader() {
  const hasControls = useTableStore.use.hasControls();
  const isLoading = useTableStore.use.isLoading();
  const error = useTableStore.use.error();
  const hasNoData = useTableStore.use.hasNoData();
  const isFilteredEmpty = useTableStore.use.isFilteredEmpty();
  const filters = useTableStore.use.filters();
  const headerSlot = useTableStore.use.headerSlot();
  const renderToolbar = useTableStore.use.renderToolbar();
  const classNames = useTableStore.use.classNames();
  const isCustomMode = useTableStore.use.isCustomMode();
  const showViewToggle = useTableStore.use.showViewToggle();
  const showColumnVisibility = useTableStore.use.showColumnVisibility();

  const hideDataChrome = isLoading || error || (hasNoData && !isFilteredEmpty);

  if (isCustomMode) {
    if (!showViewToggle && !showColumnVisibility && !headerSlot && !hasControls) return null;
    if (hideDataChrome) return null;
    const justify = headerSlot ? "justify-between" : "justify-end";
    return (
      <div data-ntable-header className={cn("flex shrink-0 items-center gap-3 flex-wrap lg:flex-nowrap", justify, classNames?.header)}>
        {headerSlot && <div className="flex min-w-0 flex-1 items-center gap-2">{headerSlot}</div>}
        {hasControls && <div className="flex gap-2 shrink-0"><TableSettingsMenu /><TableAddButton /></div>}
      </div>
    );
  }

  const hasFilters = Array.isArray(filters) && filters.length > 0;
  const hasToolbar = Boolean(renderToolbar);
  if (!hasFilters && !hasControls && !headerSlot && !hasToolbar) return null;
  if (hideDataChrome) return null;

  const justify = (hasControls || headerSlot || hasToolbar) ? "justify-between" : "justify-start";

  return (
    <div data-ntable-header className={cn("flex shrink-0 items-center gap-3 flex-wrap lg:flex-nowrap", justify, classNames?.header)}>
      <TableFilters />
      {headerSlot && <div className="ml-auto flex shrink-0 items-center gap-2">{headerSlot}</div>}
      <TableToolbarSlot />
      {hasControls && <div className="flex gap-2 shrink-0"><TableSettingsMenu /><TableAddButton /></div>}
    </div>
  );
}
