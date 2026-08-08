/**
 * The react-query layer.
 *
 * A separate entry point because `@tanstack/react-query` is an *optional* peer
 * dependency — the same discipline `najm-kit/next` applies to `next`. Consumers
 * of the root entry never reach this file, so a project with no react-query does
 * not need it installed, and `NajmUIProvider` stays free of query policy.
 */
export {
  useOffsetInfiniteQuery,
  DEFAULT_ROW_WINDOW_SIZE,
} from "./useOffsetInfiniteQuery";
export type { UseOffsetInfiniteQueryOptions } from "./useOffsetInfiniteQuery";
export { useResponsiveOffsetList } from "./useResponsiveOffsetList";
export type { UseResponsiveOffsetListOptions } from "./useResponsiveOffsetList";

// Re-exported so a list file has one import rather than three.
export {
  fetchOffsetPage,
  createOffsetPagination,
  getPageIndex,
  cleanQuery,
  DEFAULT_PAGE_SIZE,
  DEFAULT_MAX_PAGE_SIZE,
} from "../lib/pagination";
export type {
  ApiPage,
  OffsetPage,
  OffsetPageFetcher,
  OffsetPagination,
  OffsetPageOptions,
  QueryValue,
} from "../lib/pagination";
export {
  createCardPagination,
  buildCardPaginationLabels,
} from "../components/table/cardPagination";
export type {
  ListStrategy,
  ResolvedListMode,
  CardPaginationState,
  CardPaginationLabels,
  CardPaginationKey,
} from "../components/table/cardPagination";
