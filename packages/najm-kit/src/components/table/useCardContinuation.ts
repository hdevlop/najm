import React from "react";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import type { NTableInfinitePagination } from "./paginationContract";

const DEFAULT_ROOT_MARGIN = "80px";

/**
 * Scroll-driven continuation for card lists.
 *
 * The observer root is the card list's own scroll viewport, not the document,
 * because `NTableCards` scrolls inside `NajmScroll`. Observing against the
 * viewport would never intersect.
 *
 * The observer is rebuilt whenever the row count changes so that a page which
 * does not fill the container continues chaining. `IntersectionObserver` only
 * reports transitions, and a sentinel that stays visible across an append
 * would otherwise never fire again.
 */
export function useCardContinuation({
  config,
  rowCount,
  viewportRef,
}: {
  config: NTableInfinitePagination | null;
  rowCount: number;
  viewportRef: React.RefObject<HTMLElement | null>;
}) {
  const [internalPending, setInternalPending] = React.useState(false);
  const [internalError, setInternalError] = React.useState<React.ReactNode>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [viewportReady, setViewportReady] = React.useState(false);
  const pendingRef = React.useRef(false);
  const previousRowCountRef = React.useRef(rowCount);

  // The caller rebuilds this object every render; keep the callback identity
  // stable so the observer is not torn down and rebuilt on unrelated renders.
  const configRef = React.useRef(config);
  configRef.current = config;

  const enabled = Boolean(config);
  const pending = Boolean(config?.loadingMore || internalPending);
  const error = config?.loadMoreError ?? internalError;
  const hasNextPage = Boolean(config?.hasNextPage);

  const load = React.useCallback(async () => {
    const current = configRef.current;
    if (!current) return;
    if (pendingRef.current || current.loadingMore || !current.hasNextPage) return;
    pendingRef.current = true;
    setInternalPending(true);
    setInternalError(null);
    const loadingAnnouncement = current.loadingMoreLabel ?? "Loading more items...";
    setAnnouncement(loadingAnnouncement);
    try {
      await current.onLoadMore();
    } catch {
      setInternalError(current.loadMoreErrorLabel ?? "Couldn't load more items.");
      setAnnouncement("");
    } finally {
      pendingRef.current = false;
      setInternalPending(false);
      setAnnouncement((value) => (value === loadingAnnouncement ? "" : value));
    }
  }, []);

  const { sentinelRef, scrollContainerRef, observe, doneLoading } = useInfiniteScroll(
    enabled && hasNextPage && !error,
    load,
    { rootMargin: config?.rootMargin ?? DEFAULT_ROOT_MARGIN },
  );

  React.useLayoutEffect(() => {
    const node = viewportRef.current ?? null;
    scrollContainerRef.current = node;
    const ready = Boolean(node);
    setViewportReady((value) => (value === ready ? value : ready));
  });

  React.useEffect(() => {
    const previous = previousRowCountRef.current;
    if (rowCount > previous) {
      const appended = rowCount - previous;
      setAnnouncement(
        configRef.current?.itemsLoadedLabel?.(appended)
          ?? `${appended} more ${appended === 1 ? "item" : "items"} loaded.`,
      );
    }
    previousRowCountRef.current = rowCount;
  }, [rowCount]);

  React.useEffect(() => {
    if (!pending) doneLoading();
  }, [pending, doneLoading]);

  // `viewportReady` re-arms the observer once the scroll viewport exists; it
  // must not gate observation, or a host that never resolves a viewport would
  // silently stop continuing. Falling back to the document root still works.
  React.useEffect(() => {
    if (!enabled || !hasNextPage || error) return;
    return observe();
  }, [enabled, hasNextPage, error, observe, viewportReady, rowCount]);

  return {
    /** Attach to an element rendered after the last card. */
    sentinelRef,
    /** True while a page is in flight; render shaped placeholders. */
    pending,
    /** Present only after an append failure; render the retry target. */
    error,
    /** Retry an append. Also used as the manual escape hatch after failure. */
    retry: load,
    /** Polite live-region text. Never rendered visibly. */
    announcement,
    /** Whether a sentinel should exist at all. */
    active: enabled && hasNextPage && !error,
  };
}
