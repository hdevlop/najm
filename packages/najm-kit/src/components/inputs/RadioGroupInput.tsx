import React from "react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { BaseInput } from "./BaseInput";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import type { RadioGroupInputProps } from "./types";

const layoutVariants = cva("flex items-start", { variants: { layout: { column: "flex-col gap-4", row: "flex-row gap-7" } }, defaultVariants: { layout: "row" } });

export const RadioGroupInput: React.FC<RadioGroupInputProps> = ({ value, onChange, className = "", variant = "default", status = "default", bordered, borderColor, layout = "row", items }) => (
  <BaseInput variant={variant} status={status} bordered={bordered} borderColor={borderColor} className={className}>
    <RadioGroup onValueChange={onChange} value={value} className={layoutVariants({ layout })}>
      {items.map((item) => {
        const itemValue = typeof item === "string" ? item : item.value;
        const itemLabel = typeof item === "string" ? item : item.label;
        return (
          <div key={itemValue} className="flex items-center space-y-0">
            <RadioGroupItem value={itemValue} />
            <Label className="text-sm font-normal peer-disabled:opacity-70 ml-1">{itemLabel}</Label>
          </div>
        );
      })}
    </RadioGroup>
  </BaseInput>
);
