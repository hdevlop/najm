import React, { useState } from "react";
import { Input } from "../ui/input";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { getIconColorProps, resolveIcon } from "./utils";
import { Eye, EyeOff } from "lucide-react";
import type { PasswordInputProps } from "./types";

export const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChange, placeholder = "", icon, showIcon = true, iconColor, className = "", variant = "default", status = "default" }) => {
  const [showPassword, setShowPassword] = useState(false);
  const shouldDisplayIcon = Boolean(icon) && showIcon;
  const iconProps = getIconColorProps(iconColor, "h-4 w-4");
  return (
    <BaseInput variant={variant} status={status} className={cn("h-9 gap-2", className)}>
      {shouldDisplayIcon && <span className={iconProps.className} style={iconProps.style}>{resolveIcon(icon)}</span>}
      <Input type={showPassword ? "text" : "password"} placeholder={placeholder} value={value} onChange={(ev) => onChange(ev.target.value)} className="p-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 text-muted-foreground" />
      {showPassword ? <Eye className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setShowPassword(false)} /> : <EyeOff className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setShowPassword(true)} />}
    </BaseInput>
  );
};
