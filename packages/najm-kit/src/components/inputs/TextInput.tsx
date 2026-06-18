import React from "react";
import { Input } from "../ui/input";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import type { TextInputProps } from "./types";

export const TextInput: React.FC<TextInputProps> = ({ value, onChange, placeholder = "", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default", bordered, borderColor, disabled = false, ...props }) => {
  const shouldDisplayIcon = Boolean(icon) && showIcon;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={cn("gap-2", className)} disabled={disabled}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Input placeholder={placeholder} value={value} onChange={(ev) => onChange(ev.target.value)} className="p-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 text-muted-foreground" disabled={disabled} {...props} />
    </BaseInput>
  );
};
