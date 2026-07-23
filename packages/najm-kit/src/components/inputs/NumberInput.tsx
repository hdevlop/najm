import React from "react";
import { Input } from "../ui/input";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import type { NumberInputProps } from "./types";

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, placeholder = "", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default", bordered, borderColor }) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={cn("gap-2", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Input type="number" placeholder={placeholder} value={value ?? ""} onChange={(ev) => onChange(Number(ev.target.value))} className="p-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground" />
    </BaseInput>
  );
};
