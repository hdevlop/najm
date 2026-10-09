import React, { useEffect } from "react";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";

/**
 * Asks for more rows when it scrolls into view. Place it at the end of a list
 * (inside the last item when the list is a grid). It observes against the
 * nearest ancestor that actually scrolls, so it works whether the list grows
 * with the page, sits in a dialog, or scrolls on its own. `rowCount` re-arms it
 * after each append, so a batch too short to fill the screen still continues.
 */
export function NScrollContinuation({ loadMore, rowCount }: { loadMore: () => void; rowCount: number }) {
  const { sentinelRef, scrollContainerRef, observe, doneLoading } = useInfiniteScroll(true, loadMore);

  useEffect(() => {
    let ancestor = sentinelRef.current?.parentElement ?? null;
    while (ancestor && (!/(auto|scroll)/.test(getComputedStyle(ancestor).overflowY)
      || ancestor.scrollHeight <= ancestor.clientHeight + 1)) {
      ancestor = ancestor.parentElement;
    }
    scrollContainerRef.current = ancestor;
    doneLoading();
    return observe();
  }, [observe, rowCount, scrollContainerRef, sentinelRef, doneLoading]);

  return <div ref={sentinelRef} data-ntable-list-sentinel className="h-px" aria-hidden="true" />;
}
