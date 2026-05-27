import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { BaseInput } from "./BaseInput";
import { getIconColorProps, resolveIcon } from "./utils";
import type { ComboboxInputProps, SelectItemType } from "./types";

export const ComboboxInput: React.FC<ComboboxInputProps> = ({ placeholder = "Select...", searchPlaceholder = "Search...", emptyMessage = "No results found.", value, onChange, icon, showIcon = true, iconColor, items = [], className = "", variant = "default", status = "default", disabled = false, allowFreeText = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedItems: SelectItemType[] = items.map((item) => typeof item === "string" ? { value: item, label: item } : item);
  const selectedItem = normalizedItems.find((item) => item.value === value);
  const displayLabel = selectedItem?.label ?? (allowFreeText && value ? value : "");
  const shouldDisplayIcon = Boolean(icon) && showIcon && !value;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");

  const trimmedQuery = query.trim();
  const queryMatchesItem = trimmedQuery !== "" && normalizedItems.some((i) => i.value === trimmedQuery || i.label.toLowerCase() === trimmedQuery.toLowerCase());
  const showFreeTextOption = allowFreeText && trimmedQuery !== "" && !queryMatchesItem;

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <BaseInput variant={variant} status={status} className={cn("h-9", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button variant="ghost" role="combobox" aria-expanded={open} className={cn("w-full justify-between h-auto font-normal hover:bg-transparent border-0 shadow-none focus-visible:ring-0", !displayLabel && "text-muted-foreground")} disabled={disabled}>
            <span className="truncate">{displayLabel || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-9"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && showFreeTextOption) {
                  e.preventDefault();
                  commit(trimmedQuery);
                }
              }}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
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
    </BaseInput>
  );
};
