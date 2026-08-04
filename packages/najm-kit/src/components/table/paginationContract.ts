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

/**
 * Presentation policy used while NTable is actually rendering cards.
 *
 * `paged` preserves the existing page controls. `all` renders every supplied
 * row without a footer. `load-more` also renders every supplied row and adds a
 * guarded, accessible continuation control. Applications remain responsible
 * for fetching, accumulating, filtering, sorting, authorization, and privacy.
 */
export type NTableCardPagination =
  | { mode?: "paged" }
  | { mode: "all" }
  | NTableLoadMorePagination;
