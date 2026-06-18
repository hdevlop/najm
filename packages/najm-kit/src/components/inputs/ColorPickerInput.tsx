// Color picker adapted from tweakcn (MIT, jnsahaj/tweakcn).
import React, { useRef, useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "../../lib/cn";
import { BaseInput } from "./BaseInput";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { ColorPickerInputProps } from "./types";
import {
  type ColorFormat,
  detectFormat,
  formatColor,
  parseColor,
  toPickerHex,
} from "./color/convert";

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#78716C", "#6B7280", "#000000",
];

const DEFAULT_FORMATS: ColorFormat[] = ["hex", "rgb", "hsl", "oklch"];

export function ColorPickerInput(props: ColorPickerInputProps) {
  if (props.mode === "popover") {
    return <PopoverColorPicker {...props} />;
  }
  return <SwatchesColorPicker {...props} />;
}

function SwatchesColorPicker({
  value = "#000000",
  onChange,
  colors = PRESET_COLORS,
  className,
  variant = "default",
  status = "default",
  bordered,
  borderColor,
  disabled = false,
  hideSwatches = false,
}: ColorPickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <BaseInput
      variant={variant}
      status={status}
      bordered={bordered}
      borderColor={borderColor}
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
          value={toPickerHex(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="sr-only"
        />
      </div>
      {!hideSwatches && (
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
                "w-6 h-6 rounded-md border border-border transition-transform hover:scale-110 cursor-pointer",
                value === color && "ring-2 ring-primary ring-offset-1"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </BaseInput>
  );
}

function PopoverColorPicker({
  value = "#000000",
  onChange,
  colors = PRESET_COLORS,
  className,
  variant = "default",
  status = "default",
  bordered,
  borderColor,
  disabled = false,
  hideSwatches = false,
  formats = DEFAULT_FORMATS,
  output = "preserve",
}: ColorPickerInputProps) {
  const initialFormat = formats.includes(detectFormat(value))
    ? detectFormat(value)
    : formats[0] ?? "hex";
  const [activeFormat, setActiveFormat] = useState<ColorFormat>(initialFormat);
  const [draft, setDraft] = useState<string>(value);

  // Sync external value into the draft when it changes upstream.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const outputFormat: ColorFormat | "preserve" = output;

  const emit = (raw: string) => {
    if (outputFormat === "preserve") {
      onChange(raw);
    } else {
      onChange(formatColor(raw, outputFormat));
    }
  };

  const handlePickerChange = (hex: string) => {
    setDraft(hex);
    emit(hex);
  };

  const handleTextChange = (text: string) => {
    setDraft(text);
    if (parseColor(text)) emit(text);
  };

  const handleTabChange = (next: ColorFormat) => {
    setActiveFormat(next);
    // Reformat draft for display only; do not fire onChange on tab switch.
    if (parseColor(draft)) setDraft(formatColor(draft, next));
  };

  const handlePreset = (color: string) => {
    setDraft(color);
    emit(color);
  };

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-3 w-full rounded-md border border-border bg-background px-3 py-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
            status === "error" && "border-destructive",
            className
          )}
        >
          <span
            className="w-8 h-8 rounded-md border border-border shrink-0"
            style={{ backgroundColor: toPickerHex(value) }}
          />
          <span className="text-sm text-muted-foreground font-mono truncate">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 flex flex-col gap-3" align="start">
        <HexColorPicker
          color={toPickerHex(draft)}
          onChange={handlePickerChange}
          style={{ width: "100%" }}
        />

        {formats.length > 1 && (
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {formats.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => handleTabChange(fmt)}
                className={cn(
                  "flex-1 rounded-sm px-1.5 py-1 text-xs font-medium uppercase cursor-pointer transition-colors",
                  activeFormat === fmt
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fmt}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          value={draft}
          onChange={(e) => handleTextChange(e.target.value)}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {!hideSwatches && (
          <div className="flex flex-wrap gap-1.5">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePreset(color)}
                className={cn(
                  "w-5 h-5 rounded-md border border-border transition-transform hover:scale-110 cursor-pointer",
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
