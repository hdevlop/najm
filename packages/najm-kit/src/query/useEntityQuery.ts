"use client";

import {
  useQuery,
  type DefinedUseQueryResult,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

export type EntityQueryOptions<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>;

/**
 * A typed `useQuery` pass-through that keeps Najm feature hooks consistent.
 * Callers retain the complete TanStack option surface, including `select`.
 */
export function useEntityQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: EntityQueryOptions<TQueryFnData, TError, TData, TQueryKey> & {
    initialData: TQueryFnData | (() => TQueryFnData);
  },
): DefinedUseQueryResult<TData, TError>;
export function useEntityQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: EntityQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError>;
export function useEntityQuery(
  options: EntityQueryOptions<unknown, unknown, unknown, QueryKey>,
) {
  return useQuery(options);
}
