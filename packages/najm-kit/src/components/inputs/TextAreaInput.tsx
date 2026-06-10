import React from "react";
import { Textarea } from "../ui/textarea";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import type { TextAreaInputProps } from "./types";

export const TextAreaInput: React.FC<TextAreaInputProps> = ({ value, onChange, placeholder = "", className = "", variant = "default", status = "default", bordered, borderDegree, borderColor, rows }) => (
  <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("items-start", className)}>
    <Textarea
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      className="h-full border-0 bg-transparent p-0 text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 dark:bg-transparent"
    />
  </BaseInput>
);
