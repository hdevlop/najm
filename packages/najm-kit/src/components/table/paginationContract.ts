import type { ReactNode } from "react";

export interface NTableLoadMorePagination {
  /** Render the supplied rows as one card list with an explicit continuation control. */
  mode: "load-more";
  /** Whether the owning application has another server page available. */
  hasNextPage: boolean;
  /** True while the owning application is appending the next page. */
  loadingMore?: boolean;
  /** A controlled append error. Existing rows remain rendered and the control becomes Retry. */
  loadMoreError?: ReactNode;
  /** Fetch exactly one additional page. Najm Kit never constructs or owns the request. */
  onLoadMore: () => unknown | Promise<unknown>;
  loadMoreLabel?: string;
  loadingMoreLabel?: string;
  retryLabel?: string;
  endLabel?: string;
  loadMoreErrorLabel?: string;
  /** Localize the polite announcement made after appended rows arrive. */
  itemsLoadedLabel?: (count: number) => string;
}

export interface NTableInfinitePagination {
  /**
   * Render the supplied rows as one card list that continues automatically when
   * the end of the list scrolls into view. No control and no end-of-list
   * element are rendered while the list is healthy; the continuation button
   * appears only after an append failure, as the retry target.
   */
  mode: "infinite";
  /** Whether the owning application has another server page available. */
  hasNextPage: boolean;
  /** True while the owning application is appending the next page. */
  loadingMore?: boolean;
  /** A controlled append error. Existing rows remain rendered and Retry appears. */
  loadMoreError?: ReactNode;
  /** Fetch exactly one additional page. Najm Kit never constructs or owns the request. */
  onLoadMore: () => unknown | Promise<unknown>;
  /**
   * Distance ahead of the list end at which the next page is requested.
   * Defaults to `"80px"`.
   */
  rootMargin?: string;
  loadingMoreLabel?: string;
  retryLabel?: string;
  loadMoreErrorLabel?: string;
  /** Localize the polite announcement made after appended rows arrive. */
  itemsLoadedLabel?: (count: number) => string;
}

/**
 * Presentation policy used while NTable is actually rendering cards.
 *
 * `paged` preserves the existing page controls. `all` renders every supplied
 * row without a footer, in card and table modes alike. `load-more` renders
 * every supplied row and adds a guarded, accessible continuation control.
 * `infinite` renders every supplied row and continues on scroll instead.
 *
 * Applications remain responsible for fetching, accumulating, filtering,
 * sorting, authorization, and privacy. `all` renders exactly the rows it is
 * given and never fetches, so a caller that has not loaded the whole set must
 * not select it.
 */
export type NTableCardPagination =
  | { mode?: "paged" }
  | { mode: "all" }
  | NTableLoadMorePagination
  | NTableInfinitePagination;
