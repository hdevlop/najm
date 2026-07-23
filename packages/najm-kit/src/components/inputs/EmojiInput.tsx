import React from "react";
import { cn } from "../../lib/cn";
import { BaseInput } from "./BaseInput";
import type { EmojiInputProps } from "./types";

const DEFAULT_OPTIONS = [
  { value: 5, label: "Excellent" },
  { value: 4, label: "Good" },
  { value: 3, label: "Neutral" },
  { value: 2, label: "Bad" },
  { value: 1, label: "Terrible" },
];

function FaceIcon({ active, color }: { active: boolean; color: string }) {
  const bg = active ? color : "#d1d5db";
  const fg = active ? "#1f2937" : "#6b7280";
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill={bg} />
      <circle cx="11" cy="13" r="2" fill={fg} />
      <circle cx="21" cy="13" r="2" fill={fg} />
      <path
        d={
          active
            ? "M10 20c2 3 10 3 12 0"
            : "M10 22h12"
        }
        stroke={fg}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FACE_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#84cc16",
  3: "#eab308",
  2: "#f97316",
  1: "#ef4444",
};

export function EmojiInput({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
  variant = "default",
  status = "default",
  bordered,
  borderColor,
  disabled = false,
}: EmojiInputProps & { disabled?: boolean }) {
  return (
    <BaseInput
      variant={variant}
      status={status}
      bordered={bordered}
     
      borderColor={borderColor}
      className={cn("gap-3 flex-wrap", className)}
      disabled={disabled}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1 cursor-pointer transition-transform",
            value === opt.value ? "scale-110" : "opacity-60 hover:opacity-80",
            disabled && "cursor-not-allowed opacity-40"
          )}
          title={opt.label}
        >
          <FaceIcon active={value === opt.value} color={FACE_COLORS[opt.value] ?? "#6b7280"} />
          <span className="text-xs text-muted-foreground">{opt.label}</span>
        </button>
      ))}
    </BaseInput>
  );
}
