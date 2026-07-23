import * as React from "react";
import { NSlider, type NSliderProps } from "../Slider";

// Legacy array-API component. Keeps `src/index.ts:96` and old call sites compiling.
export interface SliderProps
  extends Omit<NSliderProps, "value" | "defaultValue" | "onValueChange"> {
  value: number[];
  onValueChange: (value: number[]) => void;
}

export function Slider({ value, onValueChange, ...rest }: SliderProps) {
  return (
    <NSlider
      {...rest}
      value={value.length === 2 ? [value[0], value[1]] : value[0]}
      onValueChange={(v) => onValueChange(Array.isArray(v) ? [...v] : [v])}
    />
  );
}

// Form adapter for <FormInput type="slider" />. FormInput passes
// `value` + `onChange` (NOT onValueChange), so this bridges onChange -> onValueChange.
export interface SliderInputProps
  extends Omit<NSliderProps, "value" | "defaultValue" | "onValueChange" | "onChange"> {
  value?: number;
  onChange?: (value: number) => void;
  status?: "default" | "error";
  icon?: unknown;
  iconColor?: string;
  readOnly?: boolean;
}

export function SliderInput({
  value,
  onChange,
  status: _status,
  icon: _icon,
  iconColor: _iconColor,
  readOnly: _readOnly,
  ...rest
}: SliderInputProps) {
  return (
    <NSlider
      {...rest}
      value={typeof value === "number" ? value : 0}
      onValueChange={(v) => onChange?.(Array.isArray(v) ? v[0] : v)}
    />
  );
}
