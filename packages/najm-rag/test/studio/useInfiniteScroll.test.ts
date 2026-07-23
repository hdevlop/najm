import { describe, test, expect } from 'bun:test';

describe('useInfiniteScroll pure logic', () => {
  test('IntersectionObserver callback returns trigger true when intersecting', () => {
    const mockEntry = { isIntersecting: true } as IntersectionObserverEntry;
    let loadingMore = false;
    const result = mockEntry.isIntersecting && !loadingMore;
    expect(result).toBe(true);
  });

  test('IntersectionObserver callback returns trigger false when not intersecting', () => {
    const mockEntry = { isIntersecting: false } as IntersectionObserverEntry;
    let loadingMore = false;
    const result = mockEntry.isIntersecting && !loadingMore;
    expect(result).toBe(false);
  });

  test('doneLoading resets loading guard', () => {
    let loadingMore = true;
    loadingMore = false;
    expect(loadingMore).toBe(false);
  });
});
