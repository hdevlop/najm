import * as React from "react";
import { cn } from "../../lib/cn";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "p-0.5 [&_button]:h-6 [&_button]:px-1.5 [&_button]:text-xs",
  md: "p-0.5 [&_button]:h-7 [&_button]:px-2 [&_button]:text-sm",
} as const;

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-lg bg-muted",
        sizeClasses[size],
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={
              opt.ariaLabel ??
              (typeof opt.label === "string" ? opt.label : undefined)
            }
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon && <span aria-hidden="true">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
