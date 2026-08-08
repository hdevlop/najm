import { describe, expect, test } from "bun:test";

import {
  cleanQuery,
  createOffsetPagination,
  fetchOffsetPage,
  getPageIndex,
} from "../src/lib/pagination";
import type { ApiPage, OffsetPagination } from "../src/lib/pagination";

/** Records every window asked for, so the probe behaviour is observable. */
function recordingFetcher<T>(
  respond: (pagination: OffsetPagination) => ApiPage<T> | T[],
) {
  const calls: OffsetPagination[] = [];
  const fetchPage = async (pagination: OffsetPagination) => {
    calls.push(pagination);
    return respond(pagination);
  };
  return { calls, fetchPage };
}

const rowsFrom = (offset: number, count: number) =>
  Array.from({ length: count }, (_, index) => offset + index);

describe("fetchOffsetPage — endpoint reports a total", () => {
  test("answers continuation arithmetically and keeps the total", async () => {
    const { calls, fetchPage } = recordingFetcher(({ limit, offset }) => ({
      rows: rowsFrom(offset, Math.min(limit, 90 - offset)),
      total: 90,
    }));

    const page = await fetchOffsetPage(fetchPage, { limit: 25, offset: 0 });

    expect(page.rows).toHaveLength(25);
    expect(page.total).toBe(90);
    expect(page.hasNextPage).toBe(true);
    expect(page.nextOffset).toBe(25);
    expect(calls).toHaveLength(1);
  });

  test("reports no next page on the last page", async () => {
    const { fetchPage } = recordingFetcher(({ limit, offset }) => ({
      rows: rowsFrom(offset, Math.min(limit, 90 - offset)),
      total: 90,
    }));

    const page = await fetchOffsetPage(fetchPage, { limit: 25, offset: 75 });

    expect(page.rows).toHaveLength(15);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextOffset).toBe(90);
  });
});

describe("fetchOffsetPage — endpoint reports no total", () => {
  test("uses a probe row and discards it from the result", async () => {
    const { calls, fetchPage } = recordingFetcher(({ limit, offset }) =>
      rowsFrom(offset, Math.min(limit, 200 - offset)),
    );

    const page = await fetchOffsetPage(fetchPage, { limit: 25, offset: 0 });

    expect(calls[0]).toEqual({ limit: 26, offset: 0 });
    expect(page.rows).toHaveLength(25);
    expect(page.hasNextPage).toBe(true);
    expect(page.total).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test("reports the end when the probe row does not come back", async () => {
    const { fetchPage } = recordingFetcher(({ limit, offset }) =>
      rowsFrom(offset, Math.min(limit, 10 - offset)),
    );

    const page = await fetchOffsetPage(fetchPage, { limit: 25, offset: 0 });

    expect(page.rows).toHaveLength(10);
    expect(page.hasNextPage).toBe(false);
    expect(page.nextOffset).toBe(10);
  });

  test("falls back to a lookahead request at the max limit", async () => {
    // No room for a probe row at the ceiling, so continuation costs a second
    // single-row request rather than being answered for free.
    const { calls, fetchPage } = recordingFetcher(({ limit, offset }) =>
      rowsFrom(offset, Math.min(limit, 250 - offset)),
    );

    const page = await fetchOffsetPage(fetchPage, { limit: 100, offset: 0 });

    expect(calls).toEqual([
      { limit: 100, offset: 0 },
      { limit: 1, offset: 100 },
    ]);
    expect(page.rows).toHaveLength(100);
    expect(page.hasNextPage).toBe(true);
  });

  test("the lookahead can prove the end", async () => {
    const { fetchPage } = recordingFetcher(({ limit, offset }) =>
      rowsFrom(offset, Math.min(limit, 100 - offset)),
    );

    const page = await fetchOffsetPage(fetchPage, { limit: 100, offset: 0 });

    expect(page.rows).toHaveLength(100);
    expect(page.hasNextPage).toBe(false);
  });

  test("honours a custom maxLimit as the probe ceiling", async () => {
    const { calls, fetchPage } = recordingFetcher(({ limit, offset }) =>
      rowsFrom(offset, Math.min(limit, 500 - offset)),
    );

    await fetchOffsetPage(fetchPage, { limit: 50, offset: 0 }, { maxLimit: 50 });

    expect(calls[0]).toEqual({ limit: 50, offset: 0 });
    expect(calls[1]).toEqual({ limit: 1, offset: 50 });
  });
});

describe("createOffsetPagination", () => {
  test("clamps the page size into range and derives the offset", () => {
    expect(createOffsetPagination(2, 25)).toEqual({ limit: 25, offset: 50 });
    expect(createOffsetPagination(0, 0)).toEqual({ limit: 1, offset: 0 });
    expect(createOffsetPagination(0, 5000)).toEqual({ limit: 100, offset: 0 });
    expect(createOffsetPagination(-3, 25)).toEqual({ limit: 25, offset: 0 });
  });

  test("round-trips through getPageIndex", () => {
    expect(getPageIndex(createOffsetPagination(7, 20))).toBe(7);
  });
});

describe("cleanQuery", () => {
  test("drops empty entries but keeps false and zero", () => {
    expect(
      cleanQuery({
        status: "",
        page: 0,
        archived: false,
        search: undefined,
        owner: null,
        name: "amina",
      }),
    ).toEqual({ page: 0, archived: false, name: "amina" });
  });
});
