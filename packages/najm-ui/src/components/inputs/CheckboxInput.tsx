import React from "react";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import type { CheckboxInputProps } from "./types";

export const CheckboxInput: React.FC<CheckboxInputProps> = ({ value, onChange, helper, label, checkboxClassName, className, variant = "default", status = "default" }) => (
  <BaseInput variant={variant} status={status} className={cn("flex gap-2 items-center h-9", className)}>
    <Checkbox checked={value} onCheckedChange={onChange} className={cn("cursor-pointer transition-colors duration-200 border-primary", checkboxClassName)} />
    <div className="flex flex-col gap-1">
      <Label className="cursor-pointer text-muted-foreground" onClick={() => onChange(!value)}>{label}</Label>
      {helper && <Label className="text-xs text-muted-foreground">{helper}</Label>}
    </div>
  </BaseInput>
);
