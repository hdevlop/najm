import React, { createContext, useContext } from "react";
import type { NajmBorderDegree } from "../../theme/types";

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

interface VariantContextValue {
  variant: FormVariant;
  bordered?: boolean;
  borderDegree?: NajmBorderDegree;
}

const VariantContext = createContext<VariantContextValue>({ variant: "default" });

export const VariantProvider: React.FC<{
  variant?: FormVariant;
  bordered?: boolean;
  borderDegree?: NajmBorderDegree;
  children: React.ReactNode;
}> = ({ variant = "default", bordered, borderDegree, children }) => (
  <VariantContext.Provider value={{ variant, bordered, borderDegree }}>
    {children}
  </VariantContext.Provider>
);

export const useVariant = (): FormVariant => useContext(VariantContext).variant;

export const useBordered = (): boolean | undefined => useContext(VariantContext).bordered;

export const useBorderDegree = (): NajmBorderDegree | undefined => useContext(VariantContext).borderDegree;

export const useVariantPreset = (): FormSlotClassNames => VARIANT_PRESETS[useContext(VariantContext).variant];
