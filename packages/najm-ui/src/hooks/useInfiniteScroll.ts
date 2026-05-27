import { useRef, useCallback } from 'react';

export function useInfiniteScroll(
  hasMore: boolean,
  onLoadMore: () => void,
  options?: { rootMargin?: string }
) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const loadingMoreRef = useRef(false);

  const observe = useCallback(() => {
    if (!sentinelRef.current) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMoreRef.current) {
          loadingMoreRef.current = true;
          onLoadMore();
        }
      },
      { root: scrollContainerRef.current ?? null, rootMargin: options?.rootMargin ?? '80px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, options?.rootMargin]);

  const doneLoading = useCallback(() => {
    loadingMoreRef.current = false;
  }, []);

  return { sentinelRef, scrollContainerRef, observe, doneLoading };
}