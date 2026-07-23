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
    label: "text-[11px] uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2",
    input: "h-10 bg-card",
    description: "text-xs text-muted-foreground",
    error: "text-xs text-destructive",
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
}

const VariantContext = createContext<VariantContextValue>({ variant: "default" });

export const VariantProvider: React.FC<{
  variant?: FormVariant;
  bordered?: boolean;
  children: React.ReactNode;
}> = ({ variant = "default", bordered, children }) => (
  <VariantContext.Provider value={{ variant, bordered }}>
    {children}
  </VariantContext.Provider>
);

export const useVariant = (): FormVariant => useContext(VariantContext).variant;

export const useBordered = (): boolean | undefined => useContext(VariantContext).bordered;

export const useVariantPreset = (): FormSlotClassNames => VARIANT_PRESETS[useContext(VariantContext).variant];
