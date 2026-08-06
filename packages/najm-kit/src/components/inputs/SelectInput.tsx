import React from "react";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import type { SelectInputProps, SelectItemType } from "./types";

const EMPTY_VALUE = "__najm_select_empty_value__";

function renderItems(items: (string | SelectItemType)[]) {
  return items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    const itemIcon = typeof item === "string" ? undefined : item.icon;
    const internalValue = value === "" ? EMPTY_VALUE : value;
    return (
      <SelectItem key={internalValue} value={internalValue}>
        {itemIcon ? (
          <span className="flex min-w-0 items-center gap-2">
            {resolveIcon(itemIcon)}
            <span className="truncate">{label}</span>
          </span>
        ) : (
          label
        )}
      </SelectItem>
    );
  });
}

export const SelectInput: React.FC<SelectInputProps> = ({ placeholder = "", ariaLabel, value, onChange, icon, showIcon = true, iconColor, items, className = "", dropdownClassName, variant = "default", status = "default", bordered, borderColor, disabled = false }) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon && !value;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  const found = items.find((item) =>
    typeof item === "string" ? item === value : item.value === value,
  );
  const displayLabel =
    typeof found === "string" ? found : found?.label ?? value;
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const pointerDismissedRef = React.useRef(false);

  return (
    <div className={cn("group relative", className)}>
      <BaseInput
        variant={variant}
        status={status}
        bordered={bordered}
        borderColor={borderColor}
        data-state={open ? "open" : "closed"}
        className="pointer-events-none group-focus-within:border-ring"
      >
        {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
        <span className={cn("flex-1 truncate text-sm", !displayLabel && "text-muted-foreground")}>{displayLabel || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </BaseInput>
      <Select
        onValueChange={(next) => onChange(next === EMPTY_VALUE ? "" : next)}
        value={value === "" ? EMPTY_VALUE : String(value)}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        key={value === "" ? EMPTY_VALUE : String(value)}
      >
        <SelectTrigger
          ref={triggerRef}
          className="absolute inset-0 h-full w-full opacity-0 focus-visible:border-transparent focus-visible:ring-0"
          disabled={disabled}
          aria-label={ariaLabel || placeholder || "Select"}
        />
        <SelectContent
          className={dropdownClassName}
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
          {renderItems(items)}
        </SelectContent>
      </Select>
    </div>
  );
};
