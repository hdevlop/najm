import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";
import { calculateCardPageSize, calculateCardSkeletonCount } from "../../src/components/table/hooks";

interface Item { id: string; name: string }
const allData: Item[] = Array.from({ length: 25 }, (_, index) => ({ id: String(index + 1), name: `Item ${index + 1}` }));
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];

function Card({ data }: { data: Item }) {
  return <div data-testid="item-card">{data.name}</div>;
}

/**
 * happy-dom ships no IntersectionObserver. Stub one that records every
 * observed sentinel so a test can drive intersection explicitly.
 */
const observers: Array<{ callback: (entries: unknown[]) => void; disconnected: boolean }> = [];
const originalIntersectionObserver = (globalThis as any).IntersectionObserver;

function intersectAll() {
  for (const observer of observers) {
    if (observer.disconnected) continue;
    observer.callback([{ isIntersecting: true }]);
  }
}

beforeEach(() => {
  observers.length = 0;
  (globalThis as any).IntersectionObserver = class {
    private entry: { callback: (entries: unknown[]) => void; disconnected: boolean };
    constructor(callback: (entries: unknown[]) => void) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() { this.entry.disconnected = true; }
    takeRecords() { return []; }
  };
});

afterEach(() => {
  (globalThis as any).IntersectionObserver = originalIntersectionObserver;
});

function renderCards(cardPagination: Record<string, unknown>, props: Record<string, unknown> = {}) {
  return render(
    <div style={{ height: 600 }}>
      <NTable<Item>
        data={allData}
        columns={columns}
        renderCard={Card as any}
        mode="cards"
        defaultPagination={{ pageIndex: 0, pageSize: 10 }}
        dynamicHeight={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
        cardPagination={cardPagination as any}
        {...props}
      />
    </div>,
  );
}

describe("NTable infinite card continuation", () => {
  test("renders every supplied card with no control and no end-of-list text", async () => {
    const { container } = renderCards({ mode: "infinite", hasNextPage: false, onLoadMore: mock() });

    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));
    expect(container.querySelector("[data-ntable-load-more]")).toBeNull();
    expect(container.querySelector("[data-ntable-load-more-end]")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).not.toContain("No more items");
  });

  test("arms a sentinel only while another page exists", async () => {
    const { container, rerender } = renderCards({ mode: "infinite", hasNextPage: true, onLoadMore: mock() });
    await waitFor(() => expect(container.querySelector("[data-ntable-cards-sentinel]")).toBeTruthy());

    rerender(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={allData}
          columns={columns}
          renderCard={Card as any}
          mode="cards"
          defaultPagination={{ pageIndex: 0, pageSize: 10 }}
          dynamicHeight={false}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
          cardPagination={{ mode: "infinite", hasNextPage: false, onLoadMore: mock() } as any}
        />
      </div>,
    );
    await waitFor(() => expect(container.querySelector("[data-ntable-cards-sentinel]")).toBeNull());
  });

  test("scrolling the list end into view requests exactly one page", async () => {
    let resolveRequest!: () => void;
    const request = new Promise<void>((resolve) => { resolveRequest = resolve; });
    const onLoadMore = mock(() => request);
    const { container } = renderCards({ mode: "infinite", hasNextPage: true, onLoadMore });

    await waitFor(() => expect(container.querySelector("[data-ntable-cards-sentinel]")).toBeTruthy());
    await act(async () => { intersectAll(); });

    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // A second intersection while the first request is still in flight is a
    // duplicate, not a new page.
    await act(async () => { intersectAll(); });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await act(async () => { resolveRequest(); await request; });
  });

  test("shows shaped placeholders instead of a spinner while appending", async () => {
    const { container } = renderCards({
      mode: "infinite",
      hasNextPage: true,
      loadingMore: true,
      onLoadMore: mock(),
    });

    await waitFor(() => expect(container.querySelectorAll("[data-ntable-loading-card]").length).toBeGreaterThan(0));
    expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25);
  });

  test("append failure keeps rows and reveals the retry target", async () => {
    const onLoadMore = mock()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(undefined);
    const { container } = renderCards({
      mode: "infinite",
      hasNextPage: true,
      onLoadMore,
      retryLabel: "Try again",
    });

    await waitFor(() => expect(container.querySelector("[data-ntable-cards-sentinel]")).toBeTruthy());
    await act(async () => { intersectAll(); });

    const alert = await waitFor(() => container.querySelector('[role="alert"]'));
    expect(alert?.textContent).toContain("Couldn't load more items");
    expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25);

    const retry = container.querySelector("[data-ntable-cards-continuation-error] button") as HTMLButtonElement;
    expect(retry.textContent).toContain("Try again");

    await act(async () => { fireEvent.click(retry); });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  test("announces appended rows politely for assistive technology", async () => {
    const itemsLoadedLabel = mock((count: number) => `${count} more results loaded`);
    const { container, rerender } = renderCards({
      mode: "infinite",
      hasNextPage: true,
      onLoadMore: mock(),
      itemsLoadedLabel,
    });
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));

    const grown = [...allData, { id: "26", name: "Item 26" }, { id: "27", name: "Item 27" }];
    rerender(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={grown}
          columns={columns}
          renderCard={Card as any}
          mode="cards"
          defaultPagination={{ pageIndex: 0, pageSize: 10 }}
          dynamicHeight={false}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
          cardPagination={{ mode: "infinite", hasNextPage: true, onLoadMore: mock(), itemsLoadedLabel } as any}
        />
      </div>,
    );

    await waitFor(() => {
      const live = container.querySelector('span[aria-live="polite"]');
      expect(live?.textContent).toBe("2 more results loaded");
    });
    expect(itemsLoadedLabel).toHaveBeenCalledWith(2);
  });
});

describe("NTable all mode outside cards", () => {
  test("renders every supplied row in table mode with no pagination controls", async () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable<Item>
          data={allData}
          columns={columns}
          mode="table"
          defaultPagination={{ pageIndex: 0, pageSize: 10 }}
          dynamicHeight={false}
          showCheckbox={false}
          showAddButton={false}
          showViewToggle={false}
          cardPagination={{ mode: "all" }}
        />
      </div>,
    );

    await waitFor(() => expect(container.querySelectorAll("tbody tr")).toHaveLength(25));
    expect(container.querySelector('[aria-label="Next"]')).toBeNull();
  });
});

describe("calculateCardPageSize", () => {
  test("floors to whole card rows so a page never overflows its container", () => {
    // 660px fits three 176px rows plus gaps; a fourth would be clipped.
    const input = { bodyHeight: 660, columnCount: 4, cardHeight: 176, gap: 12 };
    expect(calculateCardPageSize(input)).toBe(12);
    // The skeleton helper deliberately ceils, which would overflow here.
    expect(calculateCardSkeletonCount(input)).toBe(16);
  });

  test("always yields at least one whole row", () => {
    expect(calculateCardPageSize({ bodyHeight: 10, columnCount: 3, cardHeight: 176, gap: 12 })).toBe(3);
    expect(calculateCardPageSize({ bodyHeight: 0, columnCount: 2, cardHeight: 176, gap: 12 })).toBe(2);
  });
});
