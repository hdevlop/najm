import { expect, test } from "bun:test";
import type { NTableCardPagination, NTableProps } from "../../src";

const valid: NTableCardPagination = {
  mode: "load-more",
  hasNextPage: true,
  onLoadMore: async () => {},
};

// @ts-expect-error load-more mode requires an owning callback
const missingCallback: NTableCardPagination = { mode: "load-more", hasNextPage: true };

// @ts-expect-error load-more mode requires explicit server continuation state
const missingContinuation: NTableCardPagination = { mode: "load-more", onLoadMore: () => {} };

const props: Pick<NTableProps<{ id: string }>, "cardPagination"> = { cardPagination: valid };

test("public barrel exports the card pagination contract", () => {
  expect(props.cardPagination?.mode).toBe("load-more");
  expect(missingCallback.mode).toBe("load-more");
  expect(missingContinuation.mode).toBe("load-more");
});
