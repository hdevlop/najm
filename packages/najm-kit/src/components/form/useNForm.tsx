import { useMemo } from "react";
import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny, TypeOf } from "zod";

export interface UseNFormOptions<T extends ZodTypeAny> extends Omit<UseFormProps<TypeOf<T>>, "resolver"> {
  schema?: T;
}

export function useNForm<T extends ZodTypeAny>(options: UseNFormOptions<T>): UseFormReturn<TypeOf<T>> {
  const { schema, ...rest } = options;
  const resolver = useMemo(() => (schema ? zodResolver(schema as any) : undefined), [schema]);
  return useForm({ resolver, ...rest });
}
