"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { toast } from "../components/ui/sonner";

type SuccessMessage<TData, TVariables> =
  | string
  | ((data: TData, variables: TVariables) => string | undefined);
type ErrorMessage<TError> =
  | string
  | ((error: TError) => string | undefined);

/**
 * Normalizes an error the application did not resolve itself. `fallback` is the
 * caller's `errorMessage` string when it gave one.
 */
export type EntityCommandErrorResolver<TError = Error> = (
  error: TError,
  fallback?: string,
) => string;

export interface EntityCommandOptions<
  TData,
  TVariables = void,
  TError = Error,
  TOnMutateResult = unknown,
> extends Omit<
    UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
    "mutationFn" | "onError" | "onSuccess"
  > {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidate?: readonly QueryKey[];
  successMessage?: SuccessMessage<TData, TVariables>;
  errorMessage?: ErrorMessage<TError>;
  getErrorMessage?: EntityCommandErrorResolver<TError>;
  onSuccess?: UseMutationOptions<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >["onSuccess"];
  onError?: UseMutationOptions<
    TData,
    TError,
    TVariables,
    TOnMutateResult
  >["onError"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (!isRecord(value)) return undefined;
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }
  if (typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }
  return undefined;
}

/** Reads the common Fetch/Najm/Axios error shapes without owning app policy. */
export function getEntityCommandErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isRecord(error)) {
    const bodyMessage = readMessage(error.body);
    if (bodyMessage) return bodyMessage;

    const response = error.response;
    if (isRecord(response)) {
      const responseMessage = readMessage(response.data);
      if (responseMessage) return responseMessage;
    }
  }

  return (error instanceof Error && error.message) || fallback;
}

export function useEntityCommand<
  TData,
  TVariables = void,
  TError = Error,
  TOnMutateResult = unknown,
>({
  errorMessage,
  getErrorMessage = getEntityCommandErrorMessage as EntityCommandErrorResolver<TError>,
  invalidate = [],
  mutationFn,
  onError,
  onSuccess,
  successMessage,
  ...options
}: EntityCommandOptions<TData, TVariables, TError, TOnMutateResult>) {
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, TOnMutateResult>({
    ...options,
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all(
        invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );

      const message =
        typeof successMessage === "function"
          ? successMessage(data, variables)
          : successMessage;
      if (message) toast.success(message);
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      // A resolver is the application deciding what this failure means — a
      // localized denial, a redacted message — so its answer wins outright. A
      // plain string is only a fallback for an error carrying no message.
      const resolved =
        typeof errorMessage === "function" ? errorMessage(error) : undefined;
      toast.error(
        resolved ||
          getErrorMessage(
            error,
            typeof errorMessage === "string" ? errorMessage : undefined,
          ),
      );
      await onError?.(error, variables, onMutateResult, context);
    },
  });
}
