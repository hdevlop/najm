"use client";

import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
  type QueryClientConfig,
} from "@tanstack/react-query";

import type { NajmNextQueryIntegration } from "../app/react";

export interface RetryServerErrorsOptions {
  /** Number of retries after the initial failed request. */
  readonly attempts?: number;
  /** Optional status reader for application-specific error shapes. */
  readonly getStatus?: (error: unknown) => number | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getHttpErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.status === "number") return error.status;

  const response = error.response;
  return isRecord(response) && typeof response.status === "number"
    ? response.status
    : undefined;
}

/** Retries network/unknown failures and 5xx responses, never 4xx responses. */
export function retryServerErrors(
  options: RetryServerErrorsOptions = {},
): (failureCount: number, error: unknown) => boolean {
  const attempts = options.attempts ?? 1;
  if (!Number.isInteger(attempts) || attempts < 0) {
    throw new TypeError(
      "najm-next/query/tanstack: attempts must be a non-negative integer",
    );
  }
  const getStatus = options.getStatus ?? getHttpErrorStatus;
  return (failureCount, error) => {
    if (failureCount >= attempts) return false;
    const status = getStatus(error);
    return status === undefined || status >= 500;
  };
}

export const NAJM_TANSTACK_QUERY_DEFAULTS = Object.freeze({
  queries: Object.freeze({
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: retryServerErrors({ attempts: 1 }),
  }),
  mutations: Object.freeze({ retry: false }),
}) satisfies DefaultOptions;

export interface DefineNajmTanStackQueryOptions {
  /** Partial query-default overrides; unspecified Najm defaults are retained. */
  readonly queries?: DefaultOptions["queries"];
  /** Partial mutation-default overrides; unspecified Najm defaults are retained. */
  readonly mutations?: DefaultOptions["mutations"];
  /** Advanced cache instances. `defaultOptions` is composed by this adapter. */
  readonly client?: Omit<QueryClientConfig, "defaultOptions">;
}

/**
 * Enables TanStack Query with one stable client per mounted Najm application.
 * The zero-config path uses Najm's balanced defaults; applications declare
 * only their differences.
 */
export function defineNajmTanStackQuery(
  options: DefineNajmTanStackQueryOptions = {},
): NajmNextQueryIntegration<QueryClient> {
  return Object.freeze({
    createClient: () =>
      new QueryClient({
        ...options.client,
        defaultOptions: {
          queries: {
            ...NAJM_TANSTACK_QUERY_DEFAULTS.queries,
            ...options.queries,
          },
          mutations: {
            ...NAJM_TANSTACK_QUERY_DEFAULTS.mutations,
            ...options.mutations,
          },
        },
      }),
    Provider: QueryClientProvider,
  });
}
