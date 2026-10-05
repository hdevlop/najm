import React from "react";
import { Input } from "../ui/input";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import type { NumberInputProps } from "./types";

/**
 * The value an edit reports. An empty field is `undefined`, not `Number("")`,
 * which is 0: a cleared field would otherwise show "0" and the next digit
 * would read "05". A browser also reports "" while a number is half typed
 * ("-"), so this leaves that text alone instead of replacing it with "0".
 */
export function parseNumberInputValue(raw: string): number | undefined {
  return raw === "" ? undefined : Number(raw);
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({ value, onChange, placeholder = "", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default", bordered, borderColor, disabled = false, ...props }, ref) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={cn("gap-2", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Input ref={ref} type="number" placeholder={placeholder} value={value ?? ""} onChange={(ev) => onChange(parseNumberInputValue(ev.target.value))} className="p-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground" disabled={disabled} {...props} />
    </BaseInput>
  );
});

NumberInput.displayName = "NumberInput";
