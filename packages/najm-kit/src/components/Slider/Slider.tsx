import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export type SliderVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "accent"
  | "success"
  | "warning"
  | "info";

export type SliderSize = "sm" | "md" | "lg";
export type SliderOrientation = "horizontal" | "vertical";

const RANGE_COLOR: Record<SliderVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

const THUMB_COLOR: Record<SliderVariant, string> = {
  default: "border-primary",
  secondary: "border-secondary",
  destructive: "border-destructive",
  accent: "border-accent",
  success: "border-emerald-500",
  warning: "border-amber-500",
  info: "border-sky-500",
};

const TRACK_SIZE: Record<SliderSize, { horizontal: string; vertical: string }> = {
  sm: { horizontal: "h-1", vertical: "w-1" },
  md: { horizontal: "h-1.5", vertical: "w-1.5" },
  lg: { horizontal: "h-2", vertical: "w-2" },
};

const THUMB_SIZE: Record<SliderSize, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
};

const sliderVariants = cva(
  "relative flex touch-none select-none",
  {
    variants: {
      size: {
        sm: "",
        md: "",
        lg: "",
      },
      orientation: {
        horizontal: "w-full items-center",
        vertical: "h-full flex-col",
      },
    },
    defaultVariants: {
      size: "md",
      orientation: "horizontal",
    },
  }
);

export interface NSliderProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    | "value"
    | "defaultValue"
    | "onValueChange"
    | "orientation"
    | "dir"
    | "asChild"
  > {
  value?: number | [number, number];
  defaultValue?: number | [number, number];
  onValueChange?: (value: number | [number, number]) => void;

  min?: number;
  max?: number;
  step?: number;

  variant?: SliderVariant;
  size?: SliderSize;
  orientation?: SliderOrientation;

  disabled?: boolean;
  showTooltip?: boolean;
  formatTooltip?: (n: number) => string;

  dir?: "ltr" | "rtl";

  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function toArray(v: number | [number, number] | undefined, fallback: number): number[] {
  if (v === undefined) return [fallback];
  return Array.isArray(v) ? [...v] : [v];
}

function NSlider({
  value: controlledValue,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  variant = "default",
  size = "md",
  orientation = "horizontal",
  disabled = false,
  showTooltip = false,
  formatTooltip,
  dir,
  name,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: NSliderProps) {
  const isRangeMode = (v: number | [number, number] | undefined): boolean => {
    if (v === undefined) return false;
    return Array.isArray(v) && v.length === 2;
  };

  const rangeMode = isRangeMode(controlledValue ?? defaultValue);

  const toRadix = (v: number | [number, number] | undefined): number[] => {
    if (v === undefined) return rangeMode ? [min, max] : [min];
    return Array.isArray(v) ? [...v] : [v];
  };

  const initialRadix = toRadix(controlledValue ?? defaultValue);

  const [internalValues, setInternalValues] = React.useState<number[]>(initialRadix);
  const [active, setActive] = React.useState<number | null>(null);

  const currentValues = controlledValue !== undefined ? toRadix(controlledValue) : internalValues;

  const handleRadix = (arr: number[]) => {
    setInternalValues(arr);
    if (onValueChange) {
      onValueChange(rangeMode ? [arr[0], arr[1]] as [number, number] : arr[0]);
    }
  };

  const radixValue = controlledValue !== undefined ? toRadix(controlledValue) : undefined;
  const radixDefault = controlledValue === undefined ? toRadix(defaultValue) : undefined;

  const fmt = formatTooltip ?? ((n: number) => String(Math.round(n)));

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-disabled={disabled ? "" : undefined}
      value={radixValue}
      defaultValue={radixDefault}
      onValueChange={handleRadix}
      min={min}
      max={max}
      step={step}
      orientation={orientation}
      dir={dir}
      disabled={disabled}
      className={cn(sliderVariants({ size, orientation }), className)}
      {...rest}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow rounded-full bg-muted",
          TRACK_SIZE[size][orientation]
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn("absolute rounded-full", RANGE_COLOR[variant])}
        />
      </SliderPrimitive.Track>

      {currentValues.map((v, i) => (
        <SliderPrimitive.Thumb
          key={i}
          data-slot="slider-thumb"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onFocus={() => setActive(i)}
          onBlur={() => setActive(null)}
          onPointerDown={() => setActive(i)}
          onPointerUp={() => setActive(null)}
          className={cn(
            "block rounded-full bg-background border-2 shadow outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            "disabled:pointer-events-none",
            THUMB_SIZE[size],
            THUMB_COLOR[variant]
          )}
        >
          {showTooltip && active === i && (
            <span
              data-slot="slider-tooltip"
              className={cn(
                "absolute left-1/2 -translate-x-1/2 -top-7",
                "rounded bg-popover px-1.5 py-0.5 text-xs text-popover-foreground shadow-md",
                "pointer-events-none select-none whitespace-nowrap"
              )}
            >
              {fmt(v)}
            </span>
          )}
        </SliderPrimitive.Thumb>
      ))}

      {name && currentValues.map((v, i) => (
        <input
          key={`hidden-${i}`}
          type="hidden"
          name={i === 0 ? name : `${name}-${i}`}
          value={v}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

NSlider.displayName = "NSlider";

export { NSlider, sliderVariants };
