import React, { createContext, useContext } from "react";

export type FormVariant = "default" | "studio" | "compact";

export interface FormSlotClassNames {
  item?: string;
  label?: string;
  input?: string;
  description?: string;
  error?: string;
}

const VARIANT_PRESETS: Record<FormVariant, FormSlotClassNames> = {
  default: {
    item: "flex flex-col w-full",
    label: "text-foreground flex items-center gap-2",
    input: "",
    description: "",
    error: "",
  },
  studio: {
    item: "space-y-1.5 w-full",
    label: "text-[11px] uppercase tracking-[0.16em] text-txt-muted flex items-center gap-2",
    input: "h-10 bg-card",
    description: "text-xs text-txt-muted",
    error: "text-xs text-status-red",
  },
  compact: {
    item: "flex flex-col w-full gap-1",
    label: "text-xs text-foreground flex items-center gap-2",
    input: "h-8 text-sm",
    description: "text-xs",
    error: "text-xs",
  },
};

const VariantContext = createContext<FormVariant>("default");

export const VariantProvider: React.FC<{ variant?: FormVariant; children: React.ReactNode }> = ({ variant = "default", children }) => (
  <VariantContext.Provider value={variant}>{children}</VariantContext.Provider>
);

export const useVariant = (): FormVariant => useContext(VariantContext);

export const useVariantPreset = (): FormSlotClassNames => VARIANT_PRESETS[useContext(VariantContext)];
