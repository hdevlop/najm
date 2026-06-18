import React from "react";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import type { SelectInputProps, SelectItemType } from "./types";

function renderItems(items: (string | SelectItemType)[]) {
  return items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    return <SelectItem key={value} value={value}>{label}</SelectItem>;
  });
}

export const SelectInput: React.FC<SelectInputProps> = ({ placeholder = "", value, onChange, icon, showIcon = true, iconColor, items, className = "", variant = "default", status = "default", bordered, borderColor, disabled = false }) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon && !value;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const displayLabel = value ? (() => { const found = items.find((i) => typeof i === "string" ? i === value : i.value === value); return typeof found === "string" ? found : found?.label ?? value; })() : "";

  return (
    <div className={cn("relative", className)}>
      <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className="pointer-events-none">
        {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
        <span className={cn("flex-1 truncate text-sm", !displayLabel && "text-muted-foreground")}>{displayLabel || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </BaseInput>
      <Select onValueChange={onChange} value={String(value || "")} disabled={disabled} key={String(value)}>
        <SelectTrigger
          className="absolute inset-0 w-full h-full opacity-0"
          disabled={disabled}
          aria-label={placeholder || "Select"}
        />
        <SelectContent>{renderItems(items)}</SelectContent>
      </Select>
    </div>
  );
};
