import React from "react";
import { cn } from "../../lib/cn";
import { cva } from "class-variance-authority";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import type { CheckboxGroupInputProps } from "./types";

const layoutVariants = cva("flex items-start", {
  variants: {
    layout: {
      column: "flex-col gap-4",
      row: "flex-row gap-7",
    },
  },
  defaultVariants: { layout: "row" },
});

export function CheckboxGroupInput({
  value = [],
  onChange,
  items,
  layout = "row",
  className,
  variant = "default",
  status = "default",
  bordered,
  borderDegree,
  borderColor,
  disabled = false,
}: CheckboxGroupInputProps & { disabled?: boolean }) {
  const handleChange = (itemValue: string, checked: boolean) => {
    const next = checked ? [...value, itemValue] : value.filter((v) => v !== itemValue);
    onChange(next);
  };

  return (
    <BaseInput variant={variant} status={status} bordered={bordered} borderDegree={borderDegree} borderColor={borderColor} className={cn("flex-wrap", className)} disabled={disabled}>
      <div className={cn(layoutVariants({ layout }))}>
        {items.map((item) => {
          const itemValue = typeof item === "string" ? item : item.value;
          const itemLabel = typeof item === "string" ? item : item.label;
          const checked = value.includes(itemValue);

          return (
            <label key={itemValue} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={checked}
                onCheckedChange={(isChecked) => handleChange(itemValue, Boolean(isChecked))}
                disabled={disabled}
              />
              <span className="text-sm font-normal">{itemLabel}</span>
            </label>
          );
        })}
      </div>
    </BaseInput>
  );
}
