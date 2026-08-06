import type { ReactNode } from "react";

/**
 * How the page controls present position within the result.
 *
 * `numbered` renders a windowed list of page buttons. `compact` renders the
 * `Page X of Y` text with first/previous/next/last controls.
 *
 * `numbered` needs a trustworthy page count. Under `manualPagination` that
 * means the application must pass a `pageCount` derived from a real result
 * total, or — when its endpoint reports no total — pass `hasNextPage` and no
 * `pageCount` at all, which renders the unbounded bar described on the NTable
 * prop. With neither, the bar falls back to `compact` on its own rather than
 * inviting clicks on pages that may not exist.
 *
 * What it must never be handed is a `pageCount` that is really a lower bound,
 * such as `pageIndex + 2`. That reads as a two-page result on page one and a
 * three-page result on page two, so the bar grows a number per click with
 * nothing to say why. NTable warns in development when it catches a count
 * moving in lockstep with the page index.
 */
export type NTablePaginationVariant = "numbered" | "compact";

/**
 * Accessible names and visible copy for the page controls.
 *
 * Every field is optional and falls back to English. Supply them to localize —
 * the numbered variant is mostly digits, but its controls still need names.
 */
export interface NTablePaginationLabels {
  /** Labels the rows-per-page select. Defaults to `"Rows/page"`. */
  rowsPerPage?: string;
  /** Accessible name of the whole page control group. Defaults to `"Pagination"`. */
  pagination?: string;
  /** Accessible name for one page button, given a 1-based page. */
  goToPage?: (page: number) => string;
  /** Accessible name of the current page button, given a 1-based page. */
  currentPage?: (page: number) => string;
  firstPage?: string;
  previousPage?: string;
  nextPage?: string;
  lastPage?: string;
  /** The `compact` variant's position text, given 1-based values. */
  pageOf?: (page: number, pageCount: number) => string;
  /**
   * The position text when the result has no known total, given the 1-based
   * page. Defaults to `"Page X"` — there is no `of Y` to state, and repeating
   * the moving lower bound there would be the same lie the numbered bar avoids.
   */
  pageOfUnknown?: (page: number) => string;
  /** The selection summary, given selected and total row counts. */
  rowsSelected?: (selected: number, total: number) => string;
}

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
