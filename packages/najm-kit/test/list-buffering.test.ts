import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Invariants of the row buffer that behaviour tests do not reach.
 *
 * Each one is a regression that shipped: a request sized from a measured
 * container, a cache key carrying that measurement, a page count fabricated
 * from the buffer. They are asserted against the source because what makes them
 * bugs is *how* the values are derived, not what a single render returns.
 *
 * Ported from the application these hooks used to live in — the guarantees
 * moved here with the code.
 */

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

const list = readSource("../src/query/useResponsiveOffsetList.ts");
const buffer = readSource("../src/query/useOffsetInfiniteQuery.ts");
const viewport = readSource("../src/hooks/useMediaQuery.ts");

describe("list row buffering", () => {
  test("the server request size is a constant, not the display page size", () => {
    // NTable measures the page size from the rendered container, so it moves as
    // the grid, the column count, and card images settle. Binding a request to
    // it puts a round trip and a second skeleton behind every correction.
    expect(buffer).toContain("DEFAULT_ROW_WINDOW_SIZE = 50");
    expect(list).toContain(
      "windowSize: wantsAll ? maxLimit : DEFAULT_ROW_WINDOW_SIZE",
    );

    // The buffer key must not carry the display page or page size, or a
    // correction would still discard the buffer and refetch.
    expect(buffer).toContain('queryKey: [...queryKey, "buffer", windowSize]');
  });

  test("a display page is a slice of the buffer", () => {
    expect(list).toContain(
      "const start = pageIndex * pagination.pageSize;",
    );
    expect(list).toContain("rows.slice(start, start + pagination.pageSize)");
  });

  test("a shrinking total clamps an invalid last page before slicing", () => {
    expect(list).toContain(
      "Math.min(pagination.pageIndex, pageCount - 1)",
    );
    expect(list).toContain("if (pagination.pageIndex === pageIndex) return;");
    expect(list).toContain(
      "pageIndex: Math.min(current.pageIndex, pageCount - 1)",
    );
    expect(list.indexOf("const pageIndex =")).toBeLessThan(
      list.indexOf("const data ="),
    );
  });

  test("every mode reads the same buffer", () => {
    expect(list).toContain("const buffer = useOffsetInfiniteQuery({");
    // One query, not one per mode.
    expect(list.match(/useOffsetInfiniteQuery\(/g)).toHaveLength(1);
    expect(list).not.toContain("useQuery(");
  });

  test("paging forward is prefetched a page ahead", () => {
    expect(list).toContain(
      "if (rows.length >= start + pagination.pageSize * 2) return;",
    );
    expect(list).toContain("void fetchNextPage();");
  });

  test("a background window extension is not a loading state", () => {
    // Extending the buffer must leave the rows on screen; only having nothing
    // at all is a load.
    expect(list).toContain("loading: buffer.isPending,");
    expect(list).toContain(
      'loadingMore: mode === "infinite" && buffer.isFetchingNextPage,',
    );
  });

  test("page count comes from the server total when there is one", () => {
    // Without this the count was fabricated from the buffer, so a 500-row
    // result rendered "Page 1 of 2" and the last-page control went to page 2.
    expect(list).toContain("buffer.total !== null");
    expect(list).toContain(
      "Math.max(1, Math.ceil(buffer.total / pagination.pageSize))",
    );
  });

  test("page count still falls back to the buffer for a list without a total", () => {
    expect(list).toContain("const bufferedPages = Math.max(");
    expect(list).toContain(
      "Math.ceil(rows.length / pagination.pageSize),",
    );
    expect(list).toContain(
      "? bufferedPages + 1\n        : bufferedPages",
    );
  });

  test("a cached list survives navigation because the key ignores measurement", () => {
    // The display page size is measured and moves (25, then 24, then 16). A key
    // carrying it never matches on return, so every navigation missed the cache
    // and re-ran the skeleton.
    expect(buffer).not.toContain("pageSize");
    expect(list).not.toContain("pageSize }]");
  });

  test("viewport mode is read during render, not filled in from an effect", () => {
    // A mode resolved in an effect paints one frame of the wrong viewport, so a
    // desktop table page shows the card skeleton before the table skeleton.
    expect(viewport).toContain("useSyncExternalStore");
    expect(viewport).toContain("() => window.matchMedia(query).matches");
    expect(viewport).not.toContain("useState");
    expect(viewport).not.toContain("useEffect");
  });

  test("all downgrades to infinite when it fills its ceiling", () => {
    expect(list).toContain(
      "const allDowngraded = wantsAll && buffer.hasNextPage;",
    );
    // The ceiling is the server's clamp, not a second constant that can drift.
    expect(list).toContain("maxLimit = DEFAULT_MAX_PAGE_SIZE");
  });
});
