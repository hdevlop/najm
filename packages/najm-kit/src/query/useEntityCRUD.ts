"use client";

import { useTranslation } from "najm-i18n/react";
import type { QueryKey } from "@tanstack/react-query";

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

/**
 * Compatibility bridge for applications with endpoint-map CRUD hooks.
 * New feature code may prefer `useEntityQuery` and `useEntityCommand` directly.
 */
export function useEntityCRUD(
  entities: string | readonly string[],
  endpoints: EntityCrudEndpoints,
) {
  const { t } = useTranslation();
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

  const errorMessage = (error: unknown) => {
    if (typeof error === "object" && error !== null) {
      const response = "response" in error ? error.response : undefined;
      if (typeof response === "object" && response !== null && "data" in response) {
        const data = response.data;
        if (typeof data === "object" && data !== null && "message" in data) {
          const message = data.message;
          if (typeof message === "string") return translateMessage(message);
        }
      }
      if ("message" in error && typeof error.message === "string") {
        return translateMessage(error.message);
      }
    }
    return translateMessage();
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
