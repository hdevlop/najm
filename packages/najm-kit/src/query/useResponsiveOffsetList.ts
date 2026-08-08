"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCardViewport } from "../hooks/useMediaQuery";
import { DEFAULT_MAX_PAGE_SIZE } from "../lib/pagination";
import type { OffsetPageFetcher } from "../lib/pagination";
import type {
  ListStrategy,
  ResolvedListMode,
} from "../components/table/cardPagination";
import {
  DEFAULT_ROW_WINDOW_SIZE,
  useOffsetInfiniteQuery,
} from "./useOffsetInfiniteQuery";

interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

interface InternalPaginationState extends PaginationState {
  queryIdentity: string;
}

type PaginationUpdater =
  | PaginationState
  | ((current: PaginationState) => PaginationState);

export interface UseResponsiveOffsetListOptions<T> {
  enabled?: boolean;
  fetchPage: OffsetPageFetcher<T>;
  pageSize?: number;
  queryKey: readonly unknown[];
  /** Defaults to `"paged"`. See `ListStrategy`. */
  strategy?: ListStrategy;
  /** The server's `limit` clamp. Defaults to `DEFAULT_MAX_PAGE_SIZE`. */
  maxLimit?: number;
  /** Below this width the list continues on scroll. Defaults to `lg`. */
  cardBreakpoint?: number;
}

/**
 * One offset-paginated list, in whichever presentation the viewport calls for.
 *
 * Feeds `NTable` directly: the return value carries `pagination`,
 * `onPaginationChange` and `pageCount` for the page controls, and the fields
 * `createCardPagination` reads for scroll continuation.
 */
export function useResponsiveOffsetList<T>({
  enabled = true,
  fetchPage,
  pageSize = 25,
  queryKey,
  strategy = "paged",
  maxLimit = DEFAULT_MAX_PAGE_SIZE,
  cardBreakpoint,
}: UseResponsiveOffsetListOptions<T>) {
  const cardViewport = useCardViewport(cardBreakpoint);
  const queryIdentity = JSON.stringify(queryKey);
  const [paginationState, setPagination] = useState<InternalPaginationState>({
    pageIndex: 0,
    pageSize,
    queryIdentity,
  });

  // A changed query is a different result set, so the page index resets rather
  // than leaving the reader on page 7 of something they have not seen.
  const pagination =
    paginationState.queryIdentity === queryIdentity
      ? paginationState
      : { ...paginationState, pageIndex: 0, queryIdentity };

  const wantsAll = strategy === "all";
  const wantsInfinite =
    strategy === "infinite" || (strategy === "paged" && cardViewport);

  // One buffer serves every mode. `all` asks for the ceiling in a single window
  // and proves its bound by there being nothing after it.
  const buffer = useOffsetInfiniteQuery({
    enabled,
    fetchPage,
    queryKey,
    maxLimit,
    windowSize: wantsAll ? maxLimit : DEFAULT_ROW_WINDOW_SIZE,
  });
  const rows = buffer.rows;

  // `all` is a hint, not a promise: filling the ceiling disproves the bound.
  const allDowngraded = wantsAll && buffer.hasNextPage;

  const warnedRef = useRef(false);
  useEffect(() => {
    if (!allDowngraded || warnedRef.current) return;
    warnedRef.current = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[najm-kit] List ${queryIdentity} requested strategy "all" but filled ` +
          `the ${maxLimit}-row ceiling, so its bound is not real. Falling back ` +
          "to infinite continuation; give this list a paged or infinite strategy.",
      );
    }
  }, [allDowngraded, queryIdentity, maxLimit]);

  const mode: ResolvedListMode =
    wantsAll && !allDowngraded
      ? "all"
      : wantsInfinite || allDowngraded
        ? "infinite"
        : "paged";

  const start = pagination.pageIndex * pagination.pageSize;
  const data =
    mode === "paged" ? rows.slice(start, start + pagination.pageSize) : rows;

  // Extend the buffer while the reader is still on an earlier page, so moving
  // forward reads from memory instead of waiting on the network. One page of
  // lookahead is enough: a page cannot be turned faster than a window loads.
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = buffer;
  useEffect(() => {
    if (mode !== "paged") return;
    if (!hasNextPage || isFetchingNextPage) return;
    if (rows.length >= start + pagination.pageSize * 2) return;
    void fetchNextPage();
  }, [
    mode,
    hasNextPage,
    isFetchingNextPage,
    rows.length,
    start,
    pagination.pageSize,
    fetchNextPage,
  ]);

  const onPaginationChange = useCallback(
    (updater: PaginationUpdater) => {
      setPagination((current) => ({
        ...(typeof updater === "function"
          ? updater(
              current.queryIdentity === queryIdentity
                ? { pageIndex: current.pageIndex, pageSize: current.pageSize }
                : { pageIndex: 0, pageSize: current.pageSize },
            )
          : updater),
        queryIdentity,
      }));
    },
    [queryIdentity],
  );

  // With a server total the page count is simply true. Without one, the only
  // honest claim is "everything buffered, and one more page if the buffer has
  // not reached the end" — which understates a long result, and is why the
  // endpoints backing numbered pages should report a total.
  const bufferedPages = Math.max(
    1,
    Math.ceil(rows.length / pagination.pageSize),
  );
  const pageCount =
    buffer.total !== null
      ? Math.max(1, Math.ceil(buffer.total / pagination.pageSize))
      : buffer.hasNextPage
        ? bufferedPages + 1
        : bufferedPages;

  return {
    cardViewport,
    mode,
    data,
    /** Rows matching the current filters on the server, or `null` if unknown. */
    total: buffer.total,
    error: buffer.error,
    hasNextPage: mode === "infinite" && buffer.hasNextPage,
    // A background window extension is not a load. Paged readers keep the rows
    // they are looking at; only having nothing at all is a loading state.
    loading: buffer.isPending,
    loadingMore: mode === "infinite" && buffer.isFetchingNextPage,
    loadMoreError: buffer.isFetchNextPageError ? buffer.error : null,
    onLoadMore: () => buffer.fetchNextPage(),
    onPaginationChange,
    pageCount,
    pagination: {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
    },
    refetch: buffer.refetch,
  };
}
