import { parse, formatHex, formatRgb, formatHsl, converter } from "culori";

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch";

const toOklch = converter("oklch");

export function parseColor(input: string) {
  return parse((input ?? "").trim());
}

export function formatColor(input: string, format: ColorFormat): string {
  const c = parseColor(input);
  if (!c) return input;

  switch (format) {
    case "hex":
      return formatHex(c) ?? input;
    case "rgb":
      return formatRgb(c) ?? input;
    case "hsl":
      return formatHsl(c) ?? input;
    case "oklch": {
      const o = toOklch(c);
      if (!o) return input;
      const l = +o.l.toFixed(4);
      const ch = +(o.c ?? 0).toFixed(4);
      const h = +(o.h ?? 0).toFixed(2);
      return `oklch(${l} ${ch} ${h})`;
    }
  }
}

export function detectFormat(input: string): ColorFormat {
  const value = (input ?? "").trim().toLowerCase();
  if (value.startsWith("oklch")) return "oklch";
  if (value.startsWith("hsl")) return "hsl";
  if (value.startsWith("rgb")) return "rgb";
  return "hex";
}

export function toPickerHex(input: string): string {
  return formatHex(parseColor(input) ?? parseColor("#000000")!) ?? "#000000";
}
