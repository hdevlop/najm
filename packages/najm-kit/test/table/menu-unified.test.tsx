import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { Copy } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableMenu } from "../../src/components/table/NTable";

interface Row { id: string; name: string; }

const data: Row[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
];

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: mock((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: mock(),
      removeEventListener: mock(),
      addListener: mock(),
      removeListener: mock(),
      dispatchEvent: mock(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});
function menuLabels(container: HTMLElement | Document): string[] {
  const menu = container.querySelector("[data-context-menu]");
  if (!menu) return [];
  return Array.from(menu.querySelectorAll("[role=menuitem]")).map((b) => (b.textContent ?? "").trim());
}

function tableProps(overrides: Record<string, any> = {}) {
  return {
    data,
    columns,
    getRowId: (r: Row) => r.id,
    dynamicHeight: false,
    showPagination: false,
    showAddButton: false,
    showCheckbox: false,
    ...overrides,
  };
}

describe("menu-unified.test.tsx", () => {
  // ---- Object form: menu.row ----

  test("object form: row right-click opens menu.row items", async () => {
    mockMatchMedia(false);
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const row1 = container.querySelector("tbody tr[data-row]");
    expect(row1).toBeTruthy();

    fireEvent.contextMenu(row1!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  test("object form: built-in MoreVertical click opens menu.row items", async () => {
    mockMatchMedia(false);
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
    expect(document.activeElement).toBe(container.querySelector('[role="menuitem"]'));
    expect(Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent?.trim())).not.toContain("Actions");
  });

  // ---- Function shorthand ----

  test("function shorthand behaves like { row }", async () => {
    mockMatchMedia(false);
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }],
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  // ---- Background ----

  test("background right-click opens menu.background items in table mode", async () => {
    mockMatchMedia(false);
    const onRefresh = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { background: () => [{ label: "Refresh", onSelect: onRefresh }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Right-click on the scroll area (background, not on a row)
    const scrollArea = container.querySelector("[data-radix-scroll-area-viewport]") ?? container.querySelector(".os-viewport");
    // Fallback: right-click on the table body element (outside rows)
    const tableWrapper = scrollArea ?? container.querySelector("tbody") ?? container.querySelector("[data-ntable-body]");
    expect(tableWrapper).toBeTruthy();

    fireEvent.contextMenu(tableWrapper!, { clientX: 10, clientY: 10 });
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Refresh"]);
  });

  test("background right-click opens menu.background items in cards mode", async () => {
    mockMatchMedia(true);
    const onRefresh = mock();

    function CardComponent({ data: row, onClick, onContextMenu, 'data-row': dataRow, 'data-row-id': dataRowId }: any) {
      return <div data-testid={`card-${row.id}`} onClick={onClick} onContextMenu={onContextMenu} data-row={dataRow} data-row-id={dataRowId}>{row.name}</div>;
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          mode: "cards",
          renderCard: CardComponent,
          menu: { background: () => [{ label: "Refresh", onSelect: onRefresh }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Right-click on the grid container directly (background, not on a card)
    const gridContainer = container.querySelector(".grid");
    expect(gridContainer).toBeTruthy();

    fireEvent.contextMenu(gridContainer!, { clientX: 5, clientY: 5 });
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Refresh"]);
  });

  // ---- No-shell non-forwarding card ----

  test("no-shell non-forwarding card still opens row menu via container delegation", async () => {
    mockMatchMedia(true);
    const onCopy = mock();

    // This card does NOT forward onContextMenu
    function NoShellCard({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const enrichedData = data.map((d) => ({ ...d, __smsNoShell: true }));

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          data: enrichedData,
          mode: "cards",
          renderCard: NoShellCard,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const card1 = container.querySelector("[data-testid=card-1]");
    expect(card1).toBeTruthy();

    fireEvent.contextMenu(card1!);
    await new Promise((r) => setTimeout(r, 50));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  test("default-shell card still opens row menu on right-click", async () => {
    mockMatchMedia(true);
    const onCopy = mock();

    function CardComponent({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          mode: "cards",
          renderCard: CardComponent,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // Click the shell wrapper (which has data-row)
    const shell = container.querySelector("[data-row][data-row-id]");
    expect(shell).toBeTruthy();

    fireEvent.contextMenu(shell!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  test("default-shell card MoreVertical opens row menu", async () => {
    mockMatchMedia(true);
    const onCopy = mock();

    function CardComponent({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          mode: "cards",
          renderCard: CardComponent,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  test("no-shell non-forwarding card MoreVertical opens row menu", async () => {
    mockMatchMedia(true);
    const onCopy = mock();

    function NoShellCard({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const enrichedData = data.map((d) => ({ ...d, __smsNoShell: true }));

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          data: enrichedData,
          mode: "cards",
          renderCard: NoShellCard,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  // ---- Manual onRowContextMenu ----

  test("manual onRowContextMenu composes with automatic row menu and menu button", async () => {
    mockMatchMedia(false);
    const onManual = mock();
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          onRowContextMenu: onManual,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    const row1 = container.querySelector("tbody tr[data-row]");
    fireEvent.contextMenu(row1!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onManual).toHaveBeenCalledTimes(1);
    expect(menuLabels(container)).toEqual(["Copy"]);

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  test("manual onRowContextMenu can suppress the automatic row menu with preventDefault", async () => {
    mockMatchMedia(false);
    const onManual = mock((e: React.MouseEvent) => e.preventDefault());
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          onRowContextMenu: onManual,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onManual).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-context-menu]")).toBeNull();
  });

  test("manual onRowContextMenu still allows menu.background", async () => {
    mockMatchMedia(false);
    const onManual = mock();
    const onRefresh = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          onRowContextMenu: onManual,
          menu: { background: () => [{ label: "Refresh", onSelect: onRefresh }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const tableWrapper = container.querySelector("tbody") ?? container.querySelector("[data-ntable-body]");
    expect(tableWrapper).toBeTruthy();

    fireEvent.contextMenu(tableWrapper!, { clientX: 10, clientY: 10 });
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["Refresh"]);
  });

  test("manual no-shell non-forwarding card receives (e, row.original) via container delegation", async () => {
    mockMatchMedia(true);
    const onManual = mock();

    function NoShellCard({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const enrichedData = data.map((d) => ({ ...d, __smsNoShell: true }));

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          data: enrichedData,
          mode: "cards",
          renderCard: NoShellCard,
          onRowContextMenu: onManual,
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const card1 = container.querySelector("[data-testid=card-1]");
    expect(card1).toBeTruthy();

    fireEvent.contextMenu(card1!);
    await new Promise((r) => setTimeout(r, 50));

    expect(onManual).toHaveBeenCalledTimes(1);
    expect(onManual.mock.calls[0][1]).toEqual(enrichedData[0]);
  });

  test("manual no-shell card MoreVertical calls onRowContextMenu", async () => {
    mockMatchMedia(true);
    const onManual = mock();

    function NoShellCard({ data: row }: any) {
      return <div data-testid={`card-${row.id}`}>{row.name}</div>;
    }

    const enrichedData = data.map((d) => ({ ...d, __smsNoShell: true }));

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          data: enrichedData,
          mode: "cards",
          renderCard: NoShellCard,
          onRowContextMenu: onManual,
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onManual).toHaveBeenCalledTimes(1);
    expect(onManual.mock.calls[0][1]).toEqual(enrichedData[0]);
  });

  // ---- Default action-derived menu ----

  test("no menu plus onView/onEdit/onDelete derives View/Edit/Delete", async () => {
    mockMatchMedia(false);
    const onView = mock();
    const onEdit = mock();
    const onDelete = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({ onView, onEdit, onDelete })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["View", "Edit", "Delete"]);
  });

  // ---- Empty menu array ----

  test("menu.row returning [] opens no custom menu", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { row: () => [] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector("[data-context-menu]")).toBeNull();
  });

  // ---- menuButton={false} ----

  test("menuButton={false} keeps legacy View/Edit/Delete icon buttons and hides MoreVertical", async () => {
    mockMatchMedia(false);
    const onView = mock();
    const onEdit = mock();
    const onDelete = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({ onView, onEdit, onDelete, menuButton: false })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    // No MoreVertical row actions button
    expect(container.querySelector('button[aria-label="Row actions"]')).toBeNull();

    // Legacy icon buttons present
    expect(container.querySelector('button[aria-label="View"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Edit"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Delete"]')).toBeTruthy();
    expect(Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent?.trim())).toContain("Actions");
  });

  // ---- MoreVertical click does not trigger onRowClick ----

  test("MoreVertical click does not trigger onRowClick", async () => {
    mockMatchMedia(false);
    const onRowClick = mock();
    const onCopy = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          onRowClick,
          menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(menuLabels(container)).toEqual(["Copy"]);
  });

  // ---- No dead MoreVertical button ----

  test("no MoreVertical button when no menu builder and no action handlers", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({})} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(container.querySelector('button[aria-label="Row actions"]')).toBeNull();
  });

  // ---- Right-edge MoreVertical click clamps into viewport ----

  test("MoreVertical click near right edge still opens visible menu", async () => {
    mockMatchMedia(false);
    const onCopy = mock();

    // Stub getBoundingClientRect so the menu reports a realistic width
    const origGBCR = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.hasAttribute("data-context-menu")) {
        return { width: 192, height: 80, x: 0, y: 0, top: 0, right: 192, bottom: 80, left: 0 } as DOMRect;
      }
      return origGBCR.call(this);
    };

    try {
      const { container } = render(
        <div style={{ height: 600 }}>
          <NTable {...tableProps({
            menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
          })} />
        </div>
      );
      await new Promise((r) => setTimeout(r, 100));

      const btn = container.querySelector('button[aria-label="Row actions"]');
      expect(btn).toBeTruthy();

      // Simulate click near the right edge of the viewport
      const edgeX = window.innerWidth - 4;
      fireEvent.click(btn!, { clientX: edgeX, clientY: 20 });
      await new Promise((r) => setTimeout(r, 30));

      const menu = container.querySelector("[data-context-menu]");
      expect(menu).toBeTruthy();

      // Clamped left should be innerWidth - 8 - 192, not the raw edgeX
      const clampedLeft = Math.max(8, window.innerWidth - 8 - 192);
      expect((menu as HTMLElement).style.left).toBe(`${clampedLeft}px`);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGBCR;
    }
  });

  // ---- Row right-click near edge clamps into viewport ----

  test("row right-click near bottom-right clamps menu into viewport", async () => {
    mockMatchMedia(false);
    const onCopy = mock();

    const origGBCR = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.hasAttribute("data-context-menu")) {
        return { width: 192, height: 80, x: 0, y: 0, top: 0, right: 192, bottom: 80, left: 0 } as DOMRect;
      }
      return origGBCR.call(this);
    };

    try {
      const { container } = render(
        <div style={{ height: 600 }}>
          <NTable {...tableProps({
            menu: { row: (row: Row) => [{ label: "Copy", icon: Copy, onSelect: () => onCopy(row) }] },
          })} />
        </div>
      );
      await new Promise((r) => setTimeout(r, 100));

      const row1 = container.querySelector("tbody tr[data-row]");
      expect(row1).toBeTruthy();

      const edgeX = window.innerWidth - 4;
      const edgeY = window.innerHeight - 4;
      fireEvent.contextMenu(row1!, { clientX: edgeX, clientY: edgeY });
      await new Promise((r) => setTimeout(r, 30));

      const menu = container.querySelector("[data-context-menu]");
      expect(menu).toBeTruthy();

      const clampedLeft = Math.max(8, window.innerWidth - 8 - 192);
      const clampedTop = Math.max(8, window.innerHeight - 8 - 80);
      expect((menu as HTMLElement).style.left).toBe(`${clampedLeft}px`);
      expect((menu as HTMLElement).style.top).toBe(`${clampedTop}px`);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = origGBCR;
    }
  });

  // ---- Empty background builder does not suppress native menu ----

  test("menu.background returning [] does not call preventDefault", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { background: () => [] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const tableWrapper = container.querySelector(".rounded-md");
    expect(tableWrapper).toBeTruthy();

    // Use a native event so we can observe preventDefault
    let preventDefaultCalled = false;
    const nativeEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    Object.defineProperty(nativeEvent, "preventDefault", {
      value: () => { preventDefaultCalled = true; },
    });
    tableWrapper!.dispatchEvent(nativeEvent);
    await new Promise((r) => setTimeout(r, 20));

    // No custom menu rendered
    expect(document.querySelector("[data-context-menu]")).toBeNull();
    // Native menu was NOT suppressed
    expect(preventDefaultCalled).toBe(false);
  });

  // ---- Empty row builder does not call preventDefault ----

  test("menu.row returning [] on right-click does not call preventDefault", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable {...tableProps({
          menu: { row: () => [] },
        })} />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const row1 = container.querySelector("tbody tr[data-row]");
    expect(row1).toBeTruthy();

    let preventDefaultCalled = false;
    const nativeEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    Object.defineProperty(nativeEvent, "preventDefault", {
      value: () => { preventDefaultCalled = true; },
    });
    row1!.dispatchEvent(nativeEvent);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector("[data-context-menu]")).toBeNull();
    expect(preventDefaultCalled).toBe(false);
  });
});
