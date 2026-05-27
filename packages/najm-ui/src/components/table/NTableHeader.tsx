import React from "react";
import { TextInput, SelectInput, ComboboxInput, DateInput } from "../inputs";
import { Select, SelectContent, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { List, LayoutGrid, Plus, Code, FolderOpen } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import type { ViewMode } from "./store";

function TextFilter({ name, placeholder }: { name: string; placeholder?: string }) {
  const table = useTableStore.use.table();
  const column = table?.getColumn?.(name);
  if (!column) return null;
  return <TextInput value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value)} placeholder={placeholder} />;
}

function SelectFilter({ name, options, placeholder, inputType }: { name: string; options: any[]; placeholder?: string; inputType?: string }) {
  const table = useTableStore.use.table();
  const column = table?.getColumn?.(name);
  if (!column) return null;
  const allOptions = [{ value: "__clear__", label: "All" }, ...options.map((o: any) => typeof o === "string" ? { value: o, label: o } : o)];
  const InputComponent = inputType === "combobox" ? ComboboxInput : SelectInput;
  return <InputComponent value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value === "" || value === "__clear__" ? undefined : value)} items={allOptions} placeholder={placeholder || "Filter..."} />;
}

function TableFilters() {
  const table = useTableStore.use.table();
  const filters = useTableStore.use.filters();
  if (!table || !filters?.length) return null;
  return (
    <div className="flex flex-wrap gap-4 w-full">
      {filters.map((filter: any) => (
        <div key={filter.name} className="flex flex-col w-full lg:w-62">
          {filter.type === "text" && !filter.onChange ? <TextFilter name={filter.name} placeholder={filter.placeholder} /> :
           <SelectFilter name={filter.name} options={filter.options || []} placeholder={filter.placeholder} inputType={filter.type} />}
        </div>
      ))}
    </div>
  );
}

function getModeLabel(mode: ViewMode) {
  if (mode === "json") return "JSON";
  if (mode === "files") return "Files";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function TableModeButtons() {
  const showViewToggle = useTableStore.use.showViewToggle();
  const availableModes = useTableStore.use.availableModes() as readonly ViewMode[] | undefined;
  const viewMode = useTableStore.use.viewMode() as ViewMode;
  const setViewMode = useTableStore.use.setViewMode();
  const jsonValue = useTableStore.use.jsonValue();
  const renderJson = useTableStore.use.renderJson();
  const cardComponent = useTableStore.use.CardComponent();

  if (!showViewToggle) return null;

  const modes: { mode: ViewMode; icon: React.ReactNode; active: boolean }[] = [];
  const allModes: ViewMode[] = ["table", "cards", "json", "files"];
  const filteredModes = availableModes ?? allModes;

  if (filteredModes.includes("table")) {
    modes.push({ mode: "table", icon: <List className="h-3.5 w-3.5" />, active: viewMode === "table" });
  }
  // Capability check: cards only when CardComponent is provided (i.e., renderCard was given)
  if (filteredModes.includes("cards") && cardComponent) {
    modes.push({ mode: "cards", icon: <LayoutGrid className="h-3.5 w-3.5" />, active: viewMode === "cards" });
  }
  // Capability check: json only when jsonValue is provided or renderJson exists
  if (filteredModes.includes("json") && (jsonValue !== undefined || renderJson)) {
    modes.push({ mode: "json", icon: <Code className="h-3.5 w-3.5" />, active: viewMode === "json" });
  }
  // files mode is always available when listed in availableModes; custom renderer is provided by the consumer
  if (filteredModes.includes("files")) {
    modes.push({ mode: "files", icon: <FolderOpen className="h-3.5 w-3.5" />, active: viewMode === "files" });
  }

  return (
    <div role="tablist" aria-label="View mode" className="hidden items-center rounded-md border border-border bg-card p-0.5 lg:flex">
      {modes.map(({ mode, icon, active }) => (
        <button
          type="button"
          key={mode}
          role="tab"
          aria-label={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
          aria-selected={active}
          onClick={() => setViewMode(mode)}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium text-muted-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            active ? "bg-background text-foreground shadow-sm" : "hover:bg-accent hover:text-foreground"
          )}
        >
          {icon}
          <span>{getModeLabel(mode)}</span>
        </button>
      ))}
    </div>
  );
}

function TableAddButton() {
  const onAddClick = useTableStore.use.onAddClick();
  const showAddButton = useTableStore.use.showAddButton();
  const addButtonText = useTableStore.use.addButtonText();
  if (!showAddButton) return null;
  return (
    <>
      <div onClick={onAddClick} className="lg:hidden flex justify-center w-full items-center gap-2 cursor-pointer bg-primary h-10 px-4 rounded-lg hover:bg-primary/90"><Plus className="h-5 w-5 text-white" /><span className="text-white text-sm font-medium">{addButtonText || "Create"}</span></div>
      <div onClick={onAddClick} className="hidden lg:flex justify-center items-center cursor-pointer bg-primary h-10 w-10 p-1 rounded-lg hover:bg-primary/90"><Plus className="h-6 w-6 text-white" /></div>
    </>
  );
}

function ColumnVisibility() {
  const table = useTableStore.use.table();
  const showColumnVisibility = useTableStore.use.showColumnVisibility();
  if (!table || !showColumnVisibility) return null;
  return (
    <Select>
      <SelectTrigger><SelectValue placeholder="Columns" /></SelectTrigger>
      <SelectContent>{table.getAllColumns().filter((column: any) => column.getCanHide()).map((column: any) => (
        <div key={column.id} className="flex items-center space-x-2 py-1">
          <Checkbox id={column.id} checked={column.getIsVisible()} onCheckedChange={(checked: any) => column.toggleVisibility(!!checked)} />
          <label htmlFor={column.id} className="capitalize cursor-pointer text-sm">{column.id}</label>
        </div>
      ))}</SelectContent>
    </Select>
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
  const filters = useTableStore.use.filters();
  const headerSlot = useTableStore.use.headerSlot();
  const renderToolbar = useTableStore.use.renderToolbar();
  const classNames = useTableStore.use.classNames();
  const isCustomMode = useTableStore.use.isCustomMode();
  const showViewToggle = useTableStore.use.showViewToggle();

  if (isLoading || error) return null;

  if (isCustomMode) {
    // In custom mode, only show view toggle and header slot
    if (!showViewToggle && !headerSlot) return null;
    return (
      <div className={cn("flex items-center gap-3 flex-wrap lg:flex-nowrap", headerSlot ? "justify-between" : "justify-end", classNames?.header)}>
        {headerSlot && <div className="flex min-w-0 flex-1 items-center gap-2">{headerSlot}</div>}
        {showViewToggle && <TableModeButtons />}
      </div>
    );
  }

  const hasFilters = Array.isArray(filters) && filters.length > 0;
  const hasToolbar = Boolean(renderToolbar);
  if (!hasFilters && !hasControls && !headerSlot && !hasToolbar) return null;

  return (
    <div className={cn("flex items-center gap-3 flex-wrap lg:flex-nowrap", (hasControls || headerSlot || hasToolbar) ? "justify-between" : "justify-start", classNames?.header)}>
      <TableFilters />
      {headerSlot && <div className="ml-auto flex shrink-0 items-center gap-2">{headerSlot}</div>}
      <TableToolbarSlot />
      {hasControls && <div className="flex gap-2"><TableModeButtons /><TableAddButton /><ColumnVisibility /></div>}
    </div>
  );
}
