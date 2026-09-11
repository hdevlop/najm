"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "../lib/cn";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form";
import { useBordered, useVariantPreset } from "../components/form/VariantContext";
import { usePrefix } from "../components/form/PrefixContext";
import { DEFAULT_LOCATION_VALUE } from "./contracts";
import { NLocationInput } from "./NLocationInput";
import type { FormLocationInputProps, NLocationValue } from "./types";

const backgrounds = {
  card: "!bg-card",
  background: "!bg-background",
  secondary: "!bg-secondary",
  muted: "!bg-muted",
  transparent: "!bg-transparent",
} as const;

function nestedMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("message" in error && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  for (const child of Object.values(error as Record<string, unknown>)) {
    const message = nestedMessage(child);
    if (message) return message;
  }
}

export function FormLocationInput({ name, formLabel, formDescription, required = false, disabled = false, readOnly = false, hidden = false, background, classNames, onChange: consumerOnChange, ...props }: FormLocationInputProps) {
  const { control } = useFormContext();
  const prefix = usePrefix();
  const preset = useVariantPreset();
  const bordered = useBordered();
  const fieldName = prefix ? `${prefix}.${name}` : name;

  return (
    <FormField control={control} name={fieldName} render={({ field, fieldState }) => {
      const message = nestedMessage(fieldState.error);
      const handleChange = (next: NLocationValue) => { field.onChange(next); consumerOnChange?.(next); };
      return (
        <FormItem className={cn(preset.item, classNames?.item, hidden && "hidden")}>
          {formLabel && <FormLabel className={cn(preset.label, classNames?.label)}>{formLabel}{required && !disabled && !readOnly && <span className="ms-1 text-destructive">*</span>}</FormLabel>}
          <FormControl>
            <NLocationInput
              {...props}
              name={field.name}
              ref={field.ref}
              value={field.value ?? DEFAULT_LOCATION_VALUE}
              onChange={handleChange}
              onBlur={field.onBlur}
              disabled={disabled}
              readOnly={readOnly}
              bordered={bordered}
              status={fieldState.error ? "error" : "default"}
              className={cn(background && backgrounds[background], classNames?.input)}
              classNames={classNames}
            />
          </FormControl>
          {!fieldState.error && !disabled && !readOnly && formDescription && <FormDescription className={cn(preset.description, classNames?.description)}>{formDescription}</FormDescription>}
          {message ? <FormMessage className={cn(preset.error, classNames?.error)}>{message}</FormMessage> : null}
        </FormItem>
      );
    }} />
  );
}
