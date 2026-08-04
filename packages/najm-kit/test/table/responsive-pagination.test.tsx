import { afterEach, describe, expect, mock, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";

interface Item { id: string; name: string }
const allData: Item[] = Array.from({ length: 25 }, (_, index) => ({ id: String(index + 1), name: `Item ${index + 1}` }));
const columns: ColumnDef<Item>[] = [{ accessorKey: "name", header: "Name" }];
const originalMatchMedia = window.matchMedia;

function setMatchMedia(matches: boolean) {
  let current = matches;
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  const mediaQuery = {
    get matches() { return current; },
    media: "(max-width: 639px)",
    onchange: null,
    addEventListener: mock((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") changeListener = listener;
    }),
    removeEventListener: mock((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change" && changeListener === listener) changeListener = undefined;
    }),
    addListener: mock(),
    removeListener: mock(),
    dispatchEvent: mock(),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: mock(() => mediaQuery),
  });
  return (next: boolean) => {
    current = next;
    changeListener?.({ matches: next, media: mediaQuery.media } as MediaQueryListEvent);
  };
}

function Card({ data }: { data: Item }) {
  return <div data-testid="item-card">{data.name}</div>;
}

function renderTable(props: Record<string, unknown> = {}) {
  return render(
    <div style={{ height: 600 }}>
      <NTable<Item>
        data={allData}
        columns={columns}
        renderCard={Card as any}
        defaultPagination={{ pageIndex: 0, pageSize: 10 }}
        dynamicHeight={false}
        showCheckbox={false}
        showAddButton={false}
        showViewToggle={false}
        {...props}
      />
    </div>,
  );
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
});

describe("NTable card pagination", () => {
  test("default paged mobile behavior remains sliced with page controls", async () => {
    setMatchMedia(true);
    const { container } = renderTable();
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(10));
    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();
    expect(container.querySelector("[data-ntable-load-more]")).toBeNull();
  });

  test("all mode renders every supplied mobile card and hides the footer", async () => {
    setMatchMedia(true);
    const { container } = renderTable({ cardPagination: { mode: "all" } });
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));
    expect(container.querySelector("[data-ntable-pagination]")?.textContent).toBe("");
  });

  test("load-more mode renders accumulated cards and guards duplicate requests", async () => {
    setMatchMedia(true);
    let resolveRequest!: () => void;
    const request = new Promise<void>((resolve) => { resolveRequest = resolve; });
    const onLoadMore = mock(() => request);
    const { container } = renderTable({
      cardPagination: { mode: "load-more", hasNextPage: true, onLoadMore },
    });

    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));
    const button = container.querySelector("[data-ntable-load-more] button") as HTMLButtonElement;
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => { resolveRequest(); await request; });
    await waitFor(() => expect(button.disabled).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  test("append failure preserves rows and exposes a keyboard-operable retry", async () => {
    setMatchMedia(true);
    const onLoadMore = mock()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(undefined);
    const { container } = renderTable({
      cardPagination: { mode: "load-more", hasNextPage: true, onLoadMore, retryLabel: "Try again" },
    });
    const button = await waitFor(() => container.querySelector("[data-ntable-load-more] button") as HTMLButtonElement);
    fireEvent.click(button);
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load more items"));
    expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25);
    expect(button.textContent).toContain("Try again");
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(2));
  });

  test("terminal state is announced and no request control remains", async () => {
    setMatchMedia(true);
    const { container } = renderTable({
      cardPagination: { mode: "load-more", hasNextPage: false, onLoadMore: mock(), endLabel: "Everything loaded" },
    });
    const end = await waitFor(() => container.querySelector("[data-ntable-load-more-end]") as HTMLElement);
    expect(end.getAttribute("role")).toBe("status");
    expect(end.getAttribute("aria-live")).toBe("polite");
    expect(end.textContent).toBe("Everything loaded");
    expect(container.querySelector("[data-ntable-load-more] button")).toBeNull();
  });

  test("showPagination=false is an absolute override", async () => {
    setMatchMedia(true);
    const { container } = renderTable({
      showPagination: false,
      cardPagination: { mode: "load-more", hasNextPage: true, onLoadMore: mock() },
    });
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));
    expect(container.querySelector("[data-ntable-load-more]")).toBeNull();
  });

  test("desktop keeps numbered pagination for the same load-more contract", async () => {
    setMatchMedia(false);
    const { container } = renderTable({
      cardPagination: { mode: "load-more", hasNextPage: true, onLoadMore: mock() },
    });
    await waitFor(() => expect(container.querySelector("table")).toBeTruthy());
    expect(container.querySelectorAll("tbody tr[data-row]")).toHaveLength(10);
    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();
    expect(container.querySelector("[data-ntable-load-more]")).toBeNull();
  });

  test("crossing the responsive breakpoint swaps presentation without losing supplied rows", async () => {
    const resize = setMatchMedia(true);
    const onModeChange = mock();
    const { container } = renderTable({
      onModeChange,
      cardPagination: { mode: "load-more", hasNextPage: true, onLoadMore: mock() },
    });
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));

    act(() => resize(false));
    await waitFor(() => expect(container.querySelector("table")).toBeTruthy());
    expect(container.querySelectorAll("tbody tr[data-row]")).toHaveLength(10);
    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();

    act(() => resize(true));
    await waitFor(() => expect(container.querySelectorAll('[data-testid="item-card"]')).toHaveLength(25));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
