import React, { useEffect, useCallback, useMemo } from "react";
import { Form } from "../ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";
import { cn } from "../../lib/cn";
import type { FormProps } from "./types";
import { VariantProvider } from "./VariantContext";
import { useResolvedFormDevTools } from "./FormDevToolsContext";

function NFormInner<T extends ZodTypeAny>({ schema, defaultValues, onSubmit, form: externalForm, variant = "default", bordered, as = "form", className = "", id, devTools, children }: FormProps<T>) {
  const resolvedDevTools = useResolvedFormDevTools(schema, devTools);
  const resolver = useMemo(() => (schema ? zodResolver(schema as any) : undefined), [schema]);
  const internalForm = useForm({
    resolver,
    defaultValues: defaultValues as any,
  });
  const form = externalForm ?? internalForm;

  const handleFill = useCallback(() => {
    if (resolvedDevTools.fill) {
      form.reset(resolvedDevTools.fill() as any);
    }
  }, [resolvedDevTools.fill, form]);

  useEffect(() => {
    if (!resolvedDevTools.enabled || !resolvedDevTools.fill) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === resolvedDevTools.shortcut) { e.preventDefault(); handleFill(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [resolvedDevTools.enabled, resolvedDevTools.fill, resolvedDevTools.shortcut, handleFill]);

  useEffect(() => {
    const proc = (globalThis as any).process;
    if (proc?.env?.NODE_ENV !== "development") return;
    if (form.formState.errors && Object.keys(form.formState.errors).length > 0) {
      console.log("Form errors:", form.formState.errors);
    }
  }, [form.formState.errors]);

  const wrapperClass = cn("flex flex-col h-full w-full gap-4", className);
  const submit = form.handleSubmit(onSubmit);

  const inner = (
    <Form {...form}>
      <VariantProvider variant={variant} bordered={bordered}>
        {as === "form" ? (
          <form id={id} onSubmit={submit} className={wrapperClass} autoComplete="off">
            {children}
          </form>
        ) : (
          <div id={id} className={wrapperClass} onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault();
              void submit();
            }
          }}>
            {children}
          </div>
        )}
      </VariantProvider>
    </Form>
  );

  return inner;
}

export const NForm = NFormInner as <T extends ZodTypeAny>(props: FormProps<T>) => React.ReactElement;
