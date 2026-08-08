import { describe, expect, test } from "bun:test";

import {
  buildCardPaginationLabels,
  createCardPagination,
} from "../src/components/table/cardPagination";
import type { CardPaginationState } from "../src/components/table/cardPagination";

function recordingTranslate() {
  const keys: string[] = [];
  const t = (key: string, params?: Record<string, string | number>) => {
    keys.push(key);
    return params ? `${key}:${JSON.stringify(params)}` : key;
  };
  return { t, keys };
}

const infinite: CardPaginationState = {
  mode: "infinite",
  hasNextPage: true,
  loadingMore: false,
  loadMoreError: new Error("boom"),
  onLoadMore: () => {},
};

describe("buildCardPaginationLabels", () => {
  test("reads the three keys off the default prefix", () => {
    const { t, keys } = recordingTranslate();
    const labels = buildCardPaginationLabels(t);

    expect(keys).toEqual([
      "common.pagination.loadMoreError",
      "common.pagination.retryLoadMore",
    ]);
    expect(labels.itemsLoaded?.(7)).toBe(
      'common.pagination.itemsLoaded:{"count":7}',
    );
  });

  test("honours a custom prefix", () => {
    const { t, keys } = recordingTranslate();
    buildCardPaginationLabels(t, "list");

    expect(keys).toEqual(["list.loadMoreError", "list.retryLoadMore"]);
  });
});

describe("createCardPagination", () => {
  test("accepts a translator in place of a label bundle", () => {
    const result = createCardPagination(infinite, recordingTranslate().t);

    expect(result).toMatchObject({
      mode: "infinite",
      retryLabel: "common.pagination.retryLoadMore",
      loadMoreErrorLabel: "common.pagination.loadMoreError",
      loadMoreError: "common.pagination.loadMoreError",
    });
  });

  test("still accepts a label bundle", () => {
    const result = createCardPagination(infinite, { retryLabel: "Retry" });

    expect(result).toMatchObject({ mode: "infinite", retryLabel: "Retry" });
  });

  // The three lookups are rendered only in `infinite` mode, so a paged or
  // unbounded list should not pay for them.
  test("does not call the translator for modes that show no labels", () => {
    const paged = recordingTranslate();
    createCardPagination({ ...infinite, mode: "paged" }, paged.t);
    expect(paged.keys).toEqual([]);

    const all = recordingTranslate();
    createCardPagination({ ...infinite, mode: "all" }, all.t);
    expect(all.keys).toEqual([]);
  });

  test("falls back to the viewport when no mode is given", () => {
    const { t } = recordingTranslate();

    expect(
      createCardPagination(
        { ...infinite, mode: undefined, cardViewport: true },
        t,
      ),
    ).toMatchObject({ mode: "infinite" });
    expect(
      createCardPagination(
        { ...infinite, mode: undefined, cardViewport: false },
        t,
      ),
    ).toEqual({ mode: "paged" });
  });
});
