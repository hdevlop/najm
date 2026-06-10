import React, { useEffect, useCallback, useMemo } from "react";
import { Form } from "../ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";
import { cn } from "../../lib/cn";
import type { FormProps } from "./types";
import { VariantProvider } from "./VariantContext";

function NFormInner<T extends ZodTypeAny>({ schema, defaultValues, onSubmit, form: externalForm, variant = "default", bordered, borderDegree, as = "form", className = "", id, devTools, children }: FormProps<T>) {
  const resolver = useMemo(() => (schema ? zodResolver(schema as any) : undefined), [schema]);
  const internalForm = useForm({
    resolver,
    defaultValues: defaultValues as any,
  });
  const form = externalForm ?? internalForm;

  const handleFill = useCallback(() => {
    if (devTools?.fill) {
      form.reset(devTools.fill() as any);
    }
  }, [devTools, form]);

  useEffect(() => {
    if (!devTools?.enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F8") { e.preventDefault(); handleFill(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [devTools?.enabled, handleFill]);

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
      <VariantProvider variant={variant} bordered={bordered} borderDegree={borderDegree}>
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
