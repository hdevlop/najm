import React from "react";
import { Textarea } from "../ui/textarea";
import { BaseInput } from "./BaseInput";
import { cn } from "../../lib/cn";
import type { TextAreaInputProps } from "./types";

const DEFAULT_ROWS = 3;
const MIN_ROWS = 2;
const REM_PER_ROW = 1.5;
const VERTICAL_PADDING_REM = 1;

export const TextAreaInput: React.FC<TextAreaInputProps> = ({ value, onChange, placeholder = "", className = "", variant = "default", status = "default", bordered, borderColor, rows }) => {
  const visibleRows = Math.max(rows ?? DEFAULT_ROWS, MIN_ROWS);
  const minHeight = `${visibleRows * REM_PER_ROW + VERTICAL_PADDING_REM}rem`;

  return (
    <BaseInput
      variant={variant}
      status={status}
      bordered={bordered}
      borderColor={borderColor}
      className={cn("h-auto items-start", className)}
      style={{ minHeight }}
    >
      <Textarea
        rows={visibleRows}
        placeholder={placeholder}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className="h-full min-h-0 resize-y border-0 bg-transparent p-0 text-foreground placeholder:text-muted-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 dark:bg-transparent"
      />
    </BaseInput>
  );
};
