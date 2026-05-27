import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../ui/command";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { MultiSelectInputProps } from "./types";

export const MultiSelectInput: React.FC<MultiSelectInputProps> = ({ placeholder = "Select items...", value = [], onChange, icon, showIcon = true, iconColor, items, className = "", variant = "default", status = "default", disabled = false, searchPlaceholder = "Search...", emptyMessage = "No items found.", maxDisplay = 3, showSearch = true }) => {
  const [open, setOpen] = useState(false);
  const shouldDisplayIcon = Boolean(icon) && showIcon && value.length === 0;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");

  const handleSelect = (itemValue: string) => {
    onChange(value.includes(itemValue) ? value.filter((v) => v !== itemValue) : [...value, itemValue]);
  };

  const getItemLabel = (itemValue: string) => {
    const item = items.find((i) => typeof i === "string" ? i === itemValue : i.value === itemValue);
    return typeof item === "string" ? item : item?.label || itemValue;
  };

  const displayedItems = value.slice(0, maxDisplay);
  const remainingCount = value.length - maxDisplay;

  return (
    <BaseInput variant={variant} status={status} className={cn("h-9 gap-2", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <div className={cn("w-full flex items-center justify-between cursor-pointer h-full", disabled && "cursor-not-allowed opacity-50")}>
            <div className="flex items-center gap-1 flex-1 overflow-hidden">
              {value.length === 0 ? (
                <span className="text-muted-foreground text-sm">{placeholder}</span>
              ) : (
                <>
                  {displayedItems.map((itemValue) => (
                    <Badge key={itemValue} variant="secondary" className="text-xs px-2 py-0.5 gap-1">
                      {getItemLabel(itemValue)}
                      {!disabled && <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== itemValue)); }} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>}
                    </Badge>
                  ))}
                  {remainingCount > 0 && <Badge variant="secondary" className="text-xs px-2 py-0.5">+{remainingCount} more</Badge>}
                </>
              )}
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-2 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            {showSearch && <CommandInput placeholder={searchPlaceholder} className="h-9" />}
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {items.map((item) => {
                const itemValue = typeof item === "string" ? item : item.value;
                const itemLabel = typeof item === "string" ? item : item.label;
                const isSelected = value.includes(itemValue);
                return (
                  <CommandItem key={itemValue} onSelect={() => handleSelect(itemValue)} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={isSelected} onCheckedChange={() => handleSelect(itemValue)} className="pointer-events-none" />
                    <span className="flex-1">{itemLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </BaseInput>
  );
};
