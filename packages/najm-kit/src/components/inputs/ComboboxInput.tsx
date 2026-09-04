import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { defaultFilter as commandFilter } from "cmdk";
import { cn } from "../../lib/cn";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { BaseInput } from "./BaseInput";
import { getIconColorProps, resolveIcon } from "./utils";
import type { ComboboxInputProps, SelectItemType } from "./types";

export const ComboboxInput: React.FC<ComboboxInputProps> = ({ placeholder = "Select...", searchPlaceholder = "Search...", emptyMessage = "No results found.", loading = false, loadingMessage = "Loading...", onSearchChange, shouldFilter = true, value, onChange, icon, showIcon = true, iconColor, items = [], className = "", variant = "default", status = "default", bordered, borderColor, disabled = false, allowFreeText = false, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const pointerDismissedRef = React.useRef(false);
  const [query, setQuery] = useState("");
  const normalizedItems: SelectItemType[] = items.map((item) => typeof item === "string" ? { value: item, label: item } : item);
  const selectedItem = normalizedItems.find((item) => item.value === value);
  const displayLabel = selectedItem?.label ?? (allowFreeText && value ? value : "");
  const shouldDisplayIcon = Boolean(icon) && showIcon && !value;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const [activeItem, setActiveItem] = useState(selectedItem?.label ?? normalizedItems[0]?.label ?? "");

  const trimmedQuery = query.trim();
  const queryMatchesItem = trimmedQuery !== "" && normalizedItems.some((i) => i.value === trimmedQuery || i.label.toLowerCase() === trimmedQuery.toLowerCase());
  const showFreeTextOption = allowFreeText && trimmedQuery !== "" && !queryMatchesItem;

  const rankItems = (search: string) => normalizedItems
    .map((item, index) => ({
      index,
      item,
      score: shouldFilter
        ? commandFilter(item.label, search.trim(), [item.value, item.label])
        : 1,
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const commit = (next: string) => {
    onChange(next);
    setActiveItem(normalizedItems.find((item) => item.value === next)?.label ?? "");
    setOpen(false);
    setQuery("");
    onSearchChange?.("");
  };

  const updateQuery = (next: string) => {
    setActiveItem(rankItems(next)[0]?.item.label ?? "");
    setQuery(next);
    onSearchChange?.(next);
  };

  const updateActiveItem = (next: string) => {
    const nextItem = normalizedItems.find((item) => item.label === next);
    if (
      trimmedQuery !== ""
      && shouldFilter
      && (
        !nextItem
        || commandFilter(nextItem.label, trimmedQuery, [nextItem.value, nextItem.label]) <= 0
      )
    ) {
      return;
    }
    setActiveItem(next);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setActiveItem(selectedItem?.label ?? normalizedItems[0]?.label ?? "");
      }
      if (!o) {
        setQuery("");
        onSearchChange?.("");
      }
    }}>
      <PopoverTrigger asChild disabled={disabled}>
        <BaseInput
          ref={triggerRef}
          variant={variant}
          status={status}
          bordered={bordered}
          borderColor={borderColor}
          role="combobox"
          aria-label={ariaLabel}
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open}
          onKeyDown={(event) => {
            if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            setOpen(true);
          }}
          className={cn(
            "cursor-pointer outline-none data-[state=open]:border-ring",
            className,
          )}
        >
          {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
          <span className={cn("flex-1 truncate text-sm", !displayLabel && "text-muted-foreground")}>{displayLabel || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </BaseInput>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onPointerDownOutside={() => {
          pointerDismissedRef.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (!pointerDismissedRef.current) return;
          event.preventDefault();
          pointerDismissedRef.current = false;
          triggerRef.current?.blur();
        }}
      >
        <Command
          shouldFilter={shouldFilter}
          value={activeItem}
          onValueChange={updateActiveItem}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={query}
            onValueChange={updateQuery}
            onKeyDown={(e) => {
              const rankedItems = rankItems(trimmedQuery);
              if (
                trimmedQuery !== ""
                && rankedItems.length > 0
                && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
              ) {
                e.preventDefault();
                e.stopPropagation();
                const currentIndex = rankedItems.findIndex(({ item }) => item.label === activeItem);
                const nextIndex = e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? rankedItems.length - 1
                    : e.key === "ArrowDown"
                      ? Math.min(currentIndex + 1, rankedItems.length - 1)
                      : Math.max(currentIndex < 0 ? 0 : currentIndex - 1, 0);
                setActiveItem(rankedItems[nextIndex]?.item.label ?? "");
                return;
              }

              if (e.key !== "Enter") return;
              if (showFreeTextOption) {
                e.preventDefault();
                commit(trimmedQuery);
                return;
              }

              if (trimmedQuery !== "") {
                const activeMatch = normalizedItems.find((item) => item.label === activeItem);
                const nextItem = activeMatch && commandFilter(
                  activeMatch.label,
                  trimmedQuery,
                  [activeMatch.value, activeMatch.label],
                ) > 0
                  ? activeMatch
                  : rankedItems[0]?.item;
                if (nextItem) {
                  e.preventDefault();
                  commit(nextItem.value);
                }
              }
            }}
          />
          <CommandList>
            <CommandEmpty>{loading ? loadingMessage : emptyMessage}</CommandEmpty>
            <CommandGroup>
              {showFreeTextOption && (
                <CommandItem key="__free_text__" value={trimmedQuery} onSelect={() => commit(trimmedQuery)} className="cursor-pointer">
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Use "{trimmedQuery}"
                </CommandItem>
              )}
              {normalizedItems.map((item) => (
                <CommandItem key={item.value} value={item.label} keywords={[item.value, item.label]} onSelect={() => commit(value === item.value ? "" : item.value)} className="cursor-pointer">
                  <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
