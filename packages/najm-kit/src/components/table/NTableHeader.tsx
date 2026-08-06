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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SlidersHorizontal, List, LayoutGrid, Code, FolderOpen, Plus, Eye, Columns3, Search, Filter } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTableStore } from "./TableContext";
import type { ViewMode } from "./store";
import {
  DEFAULT_TABLE_HEADER_COLOR,
  DEFAULT_TABLE_HEADER_TEXT_COLOR,
  resolveTableColor,
} from "./tableColors";

/**
 * Placeholder for a filter whose column cannot be resolved yet.
 *
 * The table instance reaches the store in a layout effect, so the first pass
 * renders the toolbar before any column exists — and the container is measured
 * in that pass. Returning `null` here collapses the toolbar to nothing, the
 * body is measured one toolbar too tall, and the page size corrects itself the
 * moment the controls appear. An inert control of the right height keeps the
 * header the same size in every pass.
 */
function PendingFilter({ placeholder, icon, bordered }: { placeholder?: string; icon?: typeof Search; bordered?: boolean }) {
  return <TextInput icon={icon} value="" onChange={() => {}} placeholder={placeholder} bordered={bordered} disabled />;
}

function SearchFilter({ placeholder }: { placeholder?: string }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  if (!table) return <PendingFilter icon={Search} placeholder={placeholder ?? "Search…"} bordered={bordered} />;
  const value = (table.getState().globalFilter as string) ?? "";
  return <TextInput icon={Search} value={value} onChange={(v) => table.setGlobalFilter(v)} placeholder={placeholder ?? "Search…"} bordered={bordered} />;
}

function TextFilter({ name, placeholder, icon }: { name: string; placeholder?: string; icon?: typeof Search }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  const column = table?.getColumn?.(name);
  if (!column) return <PendingFilter icon={icon} placeholder={placeholder} bordered={bordered} />;
  return <TextInput icon={icon} value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value)} placeholder={placeholder} bordered={bordered} />;
}

function SelectFilter({ name, options, placeholder, inputType }: { name: string; options: any[]; placeholder?: string; inputType?: string }) {
  const table = useTableStore.use.table();
  const bordered = useTableStore.use.bordered();
  const column = table?.getColumn?.(name);
  if (!column) return <PendingFilter placeholder={placeholder || "Filter..."} bordered={bordered} />;
  const allOptions = [{ value: "__clear__", label: "All" }, ...options.map((o: any) => typeof o === "string" ? { value: o, label: o } : o)];
  const InputComponent = inputType === "combobox" ? ComboboxInput : SelectInput;
  return <InputComponent value={(column.getFilterValue() as string) ?? ""} onChange={(value) => column.setFilterValue(value === "" || value === "__clear__" ? undefined : value)} items={allOptions} placeholder={placeholder || "Filter..."} bordered={bordered} />;
}

function defaultWrapperClass(filter: any) {
  return filter.type === "search" ? "flex-1 min-w-[160px] max-w-sm" : "w-full sm:w-40 xl:w-56 shrink-0";
}

function RenderFilter({ filter, mobilePrimary = false }: { filter: any; mobilePrimary?: boolean }) {
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
          icon={mobilePrimary ? Search : undefined}
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
          showIcon={filter.showIcon ?? true}
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
        showIcon={filter.showIcon ?? true}
        disabled={filter.disabled}
        bordered={bordered}
        className="w-full"
      />
    );
  }

  if (filter.type === "text") {
    return <TextFilter name={filter.name} placeholder={filter.placeholder} icon={mobilePrimary ? Search : undefined} />;
  }

  // `SelectFilter` renders an inert control of its own when the table is not
  // ready, so bailing here would reintroduce the collapsing toolbar.
  void table;
  return <SelectFilter name={filter.name} options={filter.options || []} placeholder={filter.placeholder} inputType={filter.type} />;
}

function TableFilters() {
  const filters = useTableStore.use.filters();
  if (!filters?.length) return null;
  return (
    // `min-h-10` is the height of one control row. Even if every filter inside
    // resolves to nothing, the row cannot collapse and change what the body
    // measures.
    <div data-ntable-desktop-filters className="hidden min-h-10 flex-1 min-w-0 flex-wrap items-center gap-2 md:flex">
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

function TableAddButton({ mobile = false }: { mobile?: boolean }) {
  const onAddClick = useTableStore.use.onAddClick();
  const showAddButton = useTableStore.use.showAddButton();
  const addButtonText = useTableStore.use.addButtonText();
  const headerColor = useTableStore.use.headerColor();
  const headerTextColor = useTableStore.use.headerTextColor();
  const bordered = useTableStore.use.bordered();
  if (!showAddButton) return null;

  const btnStyle = mobile
    ? { color: resolveTableColor(headerColor, DEFAULT_TABLE_HEADER_COLOR) }
    : {
        backgroundColor: resolveTableColor(headerColor, DEFAULT_TABLE_HEADER_COLOR),
        color: resolveTableColor(headerTextColor, DEFAULT_TABLE_HEADER_TEXT_COLOR),
      };
  // Desktop stays filled; mobile matches the compact input/filter controls.
  const borderedCls = bordered ? "border border-muted-foreground" : "";

  return (
    <button
      type="button"
      onClick={onAddClick ?? undefined}
      style={btnStyle}
      aria-label={addButtonText || "Create"}
      title={addButtonText || "Create"}
      data-bordered={bordered === false ? "false" : "true"}
      className={cn(
        "h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:opacity-90",
        mobile
          ? cn("flex bg-card md:hidden", bordered === false ? "shadow-sm" : "border border-input hover:border-primary/70")
          : `hidden md:flex ${borderedCls}`,
      )}
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}

function MobileFiltersMenu({ filters }: { filters: any[] }) {
  const bordered = useTableStore.use.bordered();
  if (!filters.length) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filters"
          title="Filters"
          data-bordered={bordered === false ? "false" : "true"}
          className={cn(
            "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-card text-primary transition-colors hover:border-primary/70",
            bordered === false ? "shadow-sm" : "border border-input",
          )}
        >
          <Filter className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Table filters"
        className="w-[min(20rem,calc(100vw-2rem))] space-y-3 bg-card p-3"
      >
        {filters.map((filter: any) => (
          <div key={filter.name} className="w-full">
            <RenderFilter filter={filter} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TableMobileToolbar() {
  const filters = useTableStore.use.filters();
  const firstFilter = filters?.[0];

  return (
    <div data-ntable-mobile-toolbar className="flex w-full min-w-0 items-center gap-2 md:hidden">
      {firstFilter && (
        <div data-ntable-mobile-primary-filter className="min-w-0 flex-1">
          <RenderFilter filter={firstFilter} mobilePrimary />
        </div>
      )}
      <MobileFiltersMenu filters={filters?.slice(1) ?? []} />
      <TableAddButton mobile />
    </div>
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
  const isRefreshing = useTableStore.use.isRefreshing();
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

  // The real toolbar renders during loading too. Swapping it for a placeholder
  // of a different height moves the body underneath it — a two-line filter row
  // replacing a one-line skeleton costs the body 96px, which is nearly two rows
  // of page size, reported the instant the rows arrive. Rendering the real
  // controls makes the header the same height before and after by construction,
  // rather than by matching a placeholder to it pixel for pixel.
  // `hasNoData` is true while loading too, where it means "nothing has arrived
  // yet" rather than "this list is empty" — so it must not hide the toolbar, or
  // the header is short during the skeleton and full once rows land, and the
  // body loses that difference in height the moment they do.
  const hideDataChrome = error || (hasNoData && !isFilteredEmpty && !isLoading);

  // Present but not usable during a first load. The toolbar has to hold its
  // height — that is the whole reason it renders here — so it cannot be removed
  // or swapped for something shorter. Dimming costs no layout: `opacity` and
  // `pointer-events` do not participate in it, so the body is measured against
  // the same box either way. A refresh keeps its controls live, since the rows
  // underneath are still real.
  const isFirstLoad = Boolean(isLoading) && !isRefreshing;
  const firstLoadChromeClass = isFirstLoad ? "pointer-events-none opacity-60" : undefined;

  if (isCustomMode) {
    if (!showViewToggle && !showColumnVisibility && !headerSlot && !hasControls) return null;
    if (hideDataChrome) return null;
    const justify = headerSlot ? "justify-between" : "justify-end";
    return (
      <div data-ntable-header aria-busy={isFirstLoad ? "true" : undefined} className={cn("flex shrink-0 items-center gap-0 lg:gap-3 flex-wrap lg:flex-nowrap", justify, firstLoadChromeClass, classNames?.header)}>
        {headerSlot && <div className="flex min-w-0 flex-1 items-center gap-2">{headerSlot}</div>}
        {hasControls && <div className="flex gap-2 shrink-0"><span className="hidden md:contents"><TableSettingsMenu /></span><TableAddButton /></div>}
      </div>
    );
  }

  const hasFilters = Array.isArray(filters) && filters.length > 0;
  const hasToolbar = Boolean(renderToolbar);
  if (!hasFilters && !hasControls && !headerSlot && !hasToolbar) return null;
  if (hideDataChrome) return null;

  const justify = (hasControls || headerSlot || hasToolbar) ? "justify-between" : "justify-start";

  return (
    <div data-ntable-header aria-busy={isFirstLoad ? "true" : undefined} className={cn("flex shrink-0 items-center gap-0 lg:gap-3 flex-wrap lg:flex-nowrap", justify, firstLoadChromeClass, classNames?.header)}>
      <TableFilters />
      <TableMobileToolbar />
      {headerSlot && <div className="ml-auto flex shrink-0 items-center gap-2">{headerSlot}</div>}
      <TableToolbarSlot />
      {hasControls && <div className="flex gap-2 shrink-0"><span className="hidden md:contents"><TableSettingsMenu /></span><TableAddButton /></div>}
    </div>
  );
}
