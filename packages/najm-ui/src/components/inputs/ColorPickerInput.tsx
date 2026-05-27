import React, { useRef } from "react";
import { cn } from "../../lib/cn";
import { BaseInput } from "./BaseInput";
import type { ColorArrayInputProps } from "./types";

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#78716C", "#6B7280", "#000000",
];

export function ColorPickerInput({
  value = "#000000",
  onChange,
  colors = PRESET_COLORS,
  className,
  variant = "default",
  status = "default",
  disabled = false,
}: ColorArrayInputProps & { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <BaseInput
      variant={variant}
      status={status}
      className={cn("flex-col gap-3 items-start p-3", className)}
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className="w-10 h-10 rounded-md border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm text-muted-foreground font-mono">{value}</span>
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="sr-only"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(color);
            }}
            disabled={disabled}
            className={cn(
              "w-6 h-6 rounded-md border border-border transition-transform hover:scale-110",
              value === color && "ring-2 ring-primary ring-offset-1"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </BaseInput>
  );
}
