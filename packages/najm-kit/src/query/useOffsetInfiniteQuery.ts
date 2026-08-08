"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchOffsetPage } from "../lib/pagination";
import type { OffsetPage, OffsetPageFetcher } from "../lib/pagination";

export interface UseOffsetInfiniteQueryOptions<T> {
  enabled?: boolean;
  fetchPage: OffsetPageFetcher<T>;
  queryKey: readonly unknown[];
  /**
   * The size of one *server request*, not of a displayed page.
   *
   * Deliberately decoupled: the display page size is measured from the rendered
   * container and moves as the viewport, column count and card height settle.
   * Tying a request to it would put a network round trip behind every
   * measurement correction, and a second skeleton behind each round trip.
   */
  windowSize?: number;
  /** The server's `limit` clamp. Defaults to `DEFAULT_MAX_PAGE_SIZE`. */
  maxLimit?: number;
}

export const DEFAULT_ROW_WINDOW_SIZE = 50;

/**
 * An accumulating row buffer over `fetchOffsetPage`.
 *
 * Every mode of `useResponsiveOffsetList` reads from one of these — numbered
 * pages are a slice of the buffer rather than a request of their own.
 */
export function useOffsetInfiniteQuery<T>({
  enabled = true,
  fetchPage,
  queryKey,
  windowSize = DEFAULT_ROW_WINDOW_SIZE,
  maxLimit,
}: UseOffsetInfiniteQueryOptions<T>) {
  const query = useInfiniteQuery<OffsetPage<T>, Error>({
    enabled,
    initialPageParam: 0,
    queryKey: [...queryKey, "buffer", windowSize],
    queryFn: ({ pageParam }) =>
      fetchOffsetPage(
        fetchPage,
        { limit: windowSize, offset: Number(pageParam) },
        { maxLimit },
      ),
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextOffset : undefined,
  });

  const pages = query.data?.pages;

  return {
    ...query,
    rows: pages?.flatMap((page) => page.rows) ?? [],
    hasNextPage: Boolean(query.hasNextPage),
    // The newest window carries the freshest count. Reading the first page
    // instead would keep reporting a total from before the latest mutation.
    total: pages?.[pages.length - 1]?.total ?? null,
  };
}
