import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { Copy, Eye, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

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

function menuLabels(container: HTMLElement): string[] {
  const menu = container.ownerDocument.querySelector("[data-context-menu]");
  if (!menu) return [];
  return Array.from(menu.querySelectorAll("[role=menuitem]")).map((b) => (b.textContent ?? "").trim());
}

describe("row-context-menu-auto.test.tsx", () => {
  test("auto-builds View/Edit/Delete menu from action handlers on right-click", async () => {
    mockMatchMedia(false);
    const onView = mock();
    const onEdit = mock();
    const onDelete = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const row1 = container.querySelector("tbody tr[data-row]");
    expect(row1).toBeTruthy();

    fireEvent.contextMenu(row1!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["View", "Edit", "Delete"]);
  });

  test("clicking a menu item fires the handler with the row and closes the menu", async () => {
    mockMatchMedia(false);
    const onEdit = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          onEdit={onEdit}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    const editItem = Array.from(document.querySelectorAll("[data-context-menu] [role=menuitem]"))
      .find((b) => (b.textContent ?? "").trim() === "Edit");
    expect(editItem).toBeTruthy();

    fireEvent.click(editItem!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toEqual(data[0]);
    expect(document.querySelector("[data-context-menu]")).toBeNull(); // closed
  });

  test("menu extras are appended between View and Delete via menu.row override", async () => {
    mockMatchMedia(false);
    const onDuplicate = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          menu={(row) => [
            { label: "View", icon: Eye, onSelect: () => {} },
            { label: "Duplicate", icon: Copy, onSelect: () => onDuplicate(row) },
            { label: "Delete", icon: Trash2, danger: true, separatorBefore: true, onSelect: () => {} },
          ]}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(menuLabels(container)).toEqual(["View", "Duplicate", "Delete"]);
  });

  test("manual onRowContextMenu composes with the auto menu unless it prevents default", async () => {
    mockMatchMedia(false);
    const onView = mock();
    const onRowContextMenu = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          onView={onView}
          onRowContextMenu={onRowContextMenu}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onRowContextMenu).toHaveBeenCalledTimes(1);
    expect(menuLabels(container)).toEqual(["View"]);
  });

  test("manual onRowContextMenu can suppress the auto menu with preventDefault", async () => {
    mockMatchMedia(false);
    const onView = mock();
    const onRowContextMenu = mock((e: React.MouseEvent) => e.preventDefault());

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          onView={onView}
          onRowContextMenu={onRowContextMenu}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onRowContextMenu).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-context-menu]")).toBeNull();
  });

  test("no menu appears when there are no action handlers and no menu prop", async () => {
    mockMatchMedia(false);

    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={data}
          columns={columns}
          getRowId={(r) => r.id}
          dynamicHeight={false}
          showPagination={false}
          showAddButton={false}
          showCheckbox={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.contextMenu(container.querySelector("tbody tr[data-row]")!);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector("[data-context-menu]")).toBeNull();
  });
});
