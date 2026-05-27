import React from "react";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import { resolveIcon } from "./utils";
import type { SwitchInputProps } from "./types";

export const SwitchInput: React.FC<SwitchInputProps> = ({ value, onChange, label = "", helper, className = "", variant = "default", status = "default", icon, showIcon = true, iconPosition = "label", iconColor }) => (
  <BaseInput variant={variant} status={status} className={cn("gap-2 justify-between items-center", className)}>
    <div className="flex flex-col gap-1">
      <Label className="flex items-center gap-2">{iconPosition === "label" && icon && showIcon && <span className="w-4 h-4">{resolveIcon(icon)}</span>}{label}</Label>
      {helper && <Label className="text-xs text-muted-foreground">{helper}</Label>}
    </div>
    <div className="flex items-center gap-2">
      {iconPosition === "input" && icon && showIcon && <span className="w-4 h-4">{resolveIcon(icon)}</span>}
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  </BaseInput>
);
