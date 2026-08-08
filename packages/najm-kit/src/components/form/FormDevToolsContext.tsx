import React, { createContext, useContext, useMemo } from "react";
import type { ZodTypeAny } from "zod";

import {
  buildFormFill,
  type FormDevTools,
  type FormDevToolsOptions,
} from "./formFill";

interface FormDevToolsContextValue {
  enabled: boolean;
  shortcut: string;
}

const DEFAULT_FORM_DEV_TOOLS: FormDevToolsContextValue = {
  enabled: false,
  shortcut: "F8",
};

const FormDevToolsContext = createContext<FormDevToolsContextValue>(
  DEFAULT_FORM_DEV_TOOLS,
);

function normalizeFormDevTools(
  value?: boolean | FormDevToolsOptions,
): FormDevToolsContextValue {
  if (typeof value === "boolean") {
    return { ...DEFAULT_FORM_DEV_TOOLS, enabled: value };
  }
  if (!value) return DEFAULT_FORM_DEV_TOOLS;
  return {
    enabled: value.enabled ?? true,
    shortcut: value.shortcut ?? DEFAULT_FORM_DEV_TOOLS.shortcut,
  };
}

export function FormDevToolsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: boolean | FormDevToolsOptions;
}) {
  const resolved = useMemo(
    () => normalizeFormDevTools(value),
    [value],
  );
  return (
    <FormDevToolsContext.Provider value={resolved}>
      {children}
    </FormDevToolsContext.Provider>
  );
}

export function useResolvedFormDevTools<TSchema extends ZodTypeAny>(
  schema: TSchema | undefined,
  local?: FormDevTools<TSchema>,
) {
  const global = useContext(FormDevToolsContext);
  const options = typeof local === "object" ? local : undefined;
  const enabled =
    typeof local === "boolean" ? local : options?.enabled ?? global.enabled;
  const shortcut = options?.shortcut ?? global.shortcut;
  const fill = options?.fill ??
    (schema
      ? () => buildFormFill(schema, options?.overrides)
      : undefined);

  return { enabled, shortcut, fill };
}
