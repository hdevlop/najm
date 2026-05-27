import React from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from "../ui/select";
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

export const SelectInput: React.FC<SelectInputProps> = ({ placeholder = "", value, onChange, icon, showIcon = true, iconColor, items, className = "", variant = "default", status = "default", disabled = false }) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon && !value;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  return (
    <BaseInput variant={variant} status={status} className={cn("h-9 gap-2", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Select onValueChange={onChange} value={String(value || "")} disabled={disabled} key={String(value)}>
        <SelectTrigger className="w-full cursor-pointer border-0 shadow-none focus-visible:ring-0 dark:bg-transparent text-muted-foreground gap-2 p-0 bg-transparent dark:hover:bg-transparent" style={{ border: "none", boxShadow: "none" }} disabled={disabled}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] w-full overflow-y-auto">{renderItems(items)}</SelectContent>
      </Select>
    </BaseInput>
  );
};
