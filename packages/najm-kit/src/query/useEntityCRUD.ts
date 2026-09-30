"use client";

import { useTranslation } from "najm-i18n/react";
import type { QueryKey } from "@tanstack/react-query";

import { useResolvedFeedbackLabels } from "../components/feedback/feedbackDefaults";
import { useEntityCommand } from "./useEntityCommand";
import { useEntityQuery } from "./useEntityQuery";

// `any`, deliberately: this bridge reproduces the untyped endpoint-map hook it
// replaces, so an established consumer keeps compiling. New feature code uses
// `useEntityQuery` and `useEntityCommand`, which carry the full TanStack types.
interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success?: boolean;
}

type Endpoint = (...args: any[]) => Promise<any>;
type EntityCrudEndpoints = Record<string, Endpoint | undefined> & {
  getAll?: Endpoint;
  getById?: Endpoint;
  create?: Endpoint;
  update?: Endpoint;
  delete?: Endpoint;
  createBulk?: Endpoint;
  deleteBulk?: Endpoint;
};

function namesOf(entities: string | readonly string[]) {
  const names = Array.isArray(entities) ? [...entities] : [entities];
  if (!names.length || names.some((name) => !name.trim())) {
    throw new TypeError("najm-kit/query/crud: entities must not be empty");
  }
  return names;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The message of an Axios (`response.data.message`) or fetch/Najm error. */
function serverMessageOf(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const response = error.response;
  if (isRecord(response) && isRecord(response.data)) {
    const message = response.data.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  const message = error.message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function statusOf(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.status === "number") return error.status;
  const response = error.response;
  return isRecord(response) && typeof response.status === "number"
    ? response.status
    : undefined;
}

/**
 * Compatibility bridge for applications with endpoint-map CRUD hooks.
 * New feature code may prefer `useEntityQuery` and `useEntityCommand` directly.
 */
export function useEntityCRUD(
  entities: string | readonly string[],
  endpoints: EntityCrudEndpoints,
) {
  const { t } = useTranslation();
  const feedback = useResolvedFeedbackLabels();
  const entityArray = namesOf(entities);
  const primaryEntity = entityArray[0];
  const invalidate = [
    ...entityArray.map((entity): QueryKey => [entity]),
    ["file"] as const,
  ];

  const translateMessage = (
    message?: string | null,
    fallbackKey?: string,
    fallbackText = "Something went wrong",
  ) => {
    if (!message) return fallbackKey ? t(fallbackKey) : fallbackText;
    const translated = t(message);
    if (translated !== message) return translated;
    return fallbackKey ? t(fallbackKey) : fallbackText;
  };

  // A catalog key is translated. Any other message is shown only when a 4xx
  // carries it: that is the server refusing this request for a reason it
  // states, often already in the viewer's language. A guard's bare
  // "Forbidden" states none, so it reads as the feedback "Access denied". A 5xx
  // or a status-less error can carry internals (a driver or SQL message), so
  // it gets the feedback error title.
  const errorMessage = (error: unknown) => {
    const message = serverMessageOf(error);
    if (message) {
      const translated = t(message);
      if (translated !== message) return translated;
      const status = statusOf(error);
      if (status === 403 && message === "Forbidden") return feedback.forbiddenTitle;
      if (status !== undefined && status >= 400 && status < 500) return message;
    }
    return feedback.errorTitle;
  };

  const endpoint = (name: string): Endpoint => {
    const value = endpoints[name];
    if (!value) {
      throw new Error(`Endpoint ${name} not found`);
    }
    return value;
  };

  const useGetAll = (enabled = true) => {
    const query = useEntityQuery<ApiResponse>({
      queryKey: [primaryEntity],
      queryFn: endpoint("getAll"),
      enabled,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    });
    return {
      data: query.data?.data ?? [],
      isLoading: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  };

  const useGetById = (id: any, enabled = true) => {
    const query = useEntityQuery<ApiResponse>({
      queryKey: [primaryEntity, id],
      queryFn: () => endpoint("getById")(id),
      enabled: enabled && Boolean(id),
    });
    return {
      data: query.data?.data ?? null,
      isLoading: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  };

  const useGetByParam = (paramName: string, paramValue: any, enabled = true) => {
    const endpointName = `getBy${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
    const query = useEntityQuery<ApiResponse>({
      queryKey: [primaryEntity, paramName, paramValue],
      queryFn: () => endpoint(endpointName)(paramValue),
      enabled: enabled && Boolean(paramValue),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    });
    return {
      data: query.data?.data ?? [],
      isLoading: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  };

  const command = (name: string, successKey: string, fallback: string) => () =>
    useEntityCommand<ApiResponse, any>({
      mutationFn: endpoint(name),
      invalidate,
      successMessage: (response) =>
        translateMessage(response?.message, `${primaryEntity}.success.${successKey}`, fallback),
      errorMessage,
    });

  const useCreate = command("create", "created", "Created successfully");
  const useUpdate = command("update", "updated", "Updated successfully");
  const useDelete = command("delete", "deleted", "Deleted successfully");
  const useBulkCreate = command("createBulk", "created", "Created successfully");
  const useBulkDelete = command("deleteBulk", "bulkDeleted", "Deleted successfully");
  const useCustomMutation = (mutationKey: string) =>
    useEntityCommand<ApiResponse, any>({
      mutationFn: endpoint(mutationKey),
      invalidate,
      successMessage: (response) =>
        translateMessage(response?.message, `${primaryEntity}.success.updated`, "Saved successfully"),
      errorMessage,
    });

  const adaptMutation = (useCommand: () => ReturnType<typeof useCreate>) => () => {
    const mutation = useCommand();
    return {
      mutate: mutation.mutate,
      mutateAsync: mutation.mutateAsync,
      isLoading: mutation.isPending,
      isError: mutation.isError,
      error: mutation.error,
    };
  };

  return {
    useGetAll,
    useGetById,
    useGetByParam,
    useCreate: adaptMutation(useCreate),
    useUpdate: adaptMutation(useUpdate),
    useDelete: adaptMutation(useDelete),
    useBulkDelete: adaptMutation(useBulkDelete),
    useBulkCreate: adaptMutation(useBulkCreate),
    useCustomMutation: (mutationKey: string) => {
      const mutation = useCustomMutation(mutationKey);
      return {
        mutate: mutation.mutate,
        mutateAsync: mutation.mutateAsync,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
      };
    },
  };
}
