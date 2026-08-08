import type { NajmTranslate } from "../../providers/paginationLabels";
import type { NTableCardPagination } from "./paginationContract";

/**
 * How a list continues.
 *
 * - `paged` — numbered pages on desktop, scroll continuation on card viewports.
 * - `infinite` — scroll continuation everywhere.
 * - `all` — one request for the whole set, no controls. Only valid for a list
 *   with a proven bound.
 */
export type ListStrategy = "all" | "infinite" | "paged";

/** The presentation mode resolved for the current viewport and strategy. */
export type ResolvedListMode = "all" | "infinite" | "paged";

export interface CardPaginationState {
  /**
   * The resolved mode. When omitted, `cardViewport` alone decides — a card
   * viewport continues on scroll, a desktop one paginates.
   */
  mode?: ResolvedListMode;
  cardViewport?: boolean;
  hasNextPage: boolean;
  loadingMore: boolean;
  /**
   * Truthy when the last append failed. The value is not rendered — the message
   * shown is `loadMoreError` from the labels, so a thrown `Error` or an API
   * envelope can be passed straight through without leaking its text into the UI.
   */
  loadMoreError?: unknown;
  onLoadMore: () => unknown | Promise<unknown>;
}

export interface CardPaginationLabels {
  loadMoreError?: string;
  retryLabel?: string;
  itemsLoaded?: (count: number) => string;
}

export const DEFAULT_CARD_PAGINATION_KEY_PREFIX = "common.pagination";

type DefaultCardPaginationPrefix = typeof DEFAULT_CARD_PAGINATION_KEY_PREFIX;

/** The three catalog keys `buildCardPaginationLabels` reads under `Prefix`. */
export type CardPaginationKey<
  Prefix extends string = DefaultCardPaginationPrefix,
> =
  | `${Prefix}.itemsLoaded`
  | `${Prefix}.loadMoreError`
  | `${Prefix}.retryLoadMore`;

/**
 * Projects a translator onto the three card-continuation labels, matching
 * `buildPaginationLabels` — same prefix convention, same key-per-field naming.
 *
 * The keys are named in the type, not just built at runtime, so an application
 * whose `t` is typed to a generated union of its catalog can pass it directly
 * and have the three keys verified against that union.
 */
export function buildCardPaginationLabels<
  Prefix extends string = DefaultCardPaginationPrefix,
>(
  t: NajmTranslate<CardPaginationKey<Prefix>>,
  prefix?: Prefix,
): CardPaginationLabels {
  const scope = (prefix ?? DEFAULT_CARD_PAGINATION_KEY_PREFIX) as Prefix;

  return {
    loadMoreError: t(`${scope}.loadMoreError`),
    retryLabel: t(`${scope}.retryLoadMore`),
    itemsLoaded: (count) => t(`${scope}.itemsLoaded`, { count }),
  };
}

/**
 * Builds the `cardPagination` prop from the state a paged list already holds.
 *
 * The three modes are not interchangeable presentations of one thing: `paged`
 * hands page-size control back to NTable, which measures the container and
 * reports the size it wants through `onPaginationChange`; `all` renders exactly
 * what it is given and shows no controls; `infinite` is the only one that needs
 * continuation wiring, which is why the other two ignore the labels entirely.
 *
 * The second argument takes a translator as well as a label bundle. That is the
 * common case — a list page has `t` in hand and nothing else to say about these
 * three strings — and passing it here rather than pre-building labels also means
 * the lookups only happen in `infinite` mode, where they are rendered.
 */
export function createCardPagination<
  Prefix extends string = DefaultCardPaginationPrefix,
>(
  state: CardPaginationState,
  labels: CardPaginationLabels | NajmTranslate<CardPaginationKey<Prefix>> = {},
  prefix?: Prefix,
): NTableCardPagination {
  const mode = state.mode ?? (state.cardViewport ? "infinite" : "paged");

  if (mode === "paged") return { mode: "paged" };
  if (mode === "all") return { mode: "all" };

  const resolved =
    typeof labels === "function"
      ? buildCardPaginationLabels(labels, prefix)
      : labels;

  return {
    mode: "infinite",
    hasNextPage: state.hasNextPage,
    loadingMore: state.loadingMore,
    loadMoreError: state.loadMoreError ? resolved.loadMoreError : undefined,
    onLoadMore: state.onLoadMore,
    retryLabel: resolved.retryLabel,
    loadMoreErrorLabel: resolved.loadMoreError,
    itemsLoadedLabel: resolved.itemsLoaded,
  };
}
