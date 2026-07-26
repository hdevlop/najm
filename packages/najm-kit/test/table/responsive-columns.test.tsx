import { describe, test, expect } from "bun:test";
import React, { useState } from "react";
import { act, render, fireEvent } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  NTable,
  type NTableColumnDef,
  type NTableColumnBreakpoint,
} from "../../src";
import {
  filterResponsiveColumns,
  hiddenBelowClasses,
  resolveHiddenBelowClass,
} from "../../src/components/table/responsiveColumns";

interface Family {
  id: string;
  name: string;
  email: string;
  guardian: string;
}

const data: Family[] = [
  { id: "1", name: "Doe", email: "[email protected]", guardian: "Jane" },
  { id: "2", name: "Smith", email: "[email protected]", guardian: "Bob" },
];

function CardRenderer({ data: row }: { data: Family }) {
  return (
    <div data-testid="card">
      <span data-testid="card-name">{row.name}</span>
      <span data-testid="card-email">{row.email}</span>
    </div>
  );
}

function renderTable(
  columns: NTableColumnDef<Family>[],
  extraProps: Record<string, unknown> = {},
  showColumnVisibility = true,
) {
  return render(
    <div style={{ height: 600 }}>
      <NTable<Family>
        data={data}
        columns={columns}
        renderCard={CardRenderer as any}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        showColumnVisibility={showColumnVisibility}
        {...(extraProps as any)}
      />
    </div>,
  );
}

describe("NTable responsive column helper", () => {
  describe("filterResponsiveColumns", () => {
    test("omitted visible and visible: true include the column", () => {
      const columns: ColumnDef<Family, any>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email", meta: { visible: true } },
      ];
      const result = filterResponsiveColumns(columns);
      expect(result).toHaveLength(2);
    });

    test("visible: false removes the leaf column", () => {
      const columns: ColumnDef<Family, any>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email", meta: { visible: false } },
      ];
      const result = filterResponsiveColumns(columns);
      expect(result).toHaveLength(1);
      expect((result[0] as any).accessorKey).toBe("name");
    });

    test("does not mutate input column definitions", () => {
      const emailColumn: ColumnDef<Family, any> = {
        accessorKey: "email",
        header: "Email",
        meta: { visible: false, hiddenBelow: "lg" },
      };
      const original = { ...emailColumn, meta: { ...(emailColumn.meta as any) } };
      const columns: ColumnDef<Family, any>[] = [
        { accessorKey: "name", header: "Name" },
        emailColumn,
      ];
      const snapshot = columns.map((c) => ({ ...c, meta: { ...(c.meta as any) } }));
      filterResponsiveColumns(columns);
      expect(columns).toHaveLength(snapshot.length);
      expect(emailColumn).toEqual(original);
      expect(columns[1]).toEqual(snapshot[1]);
    });

    test("recursively filters grouped columns and removes empty groups", () => {
      const columns: ColumnDef<Family, any>[] = [
        {
          id: "group",
          header: "Group",
          columns: [
            { accessorKey: "name", header: "Name" },
            { accessorKey: "email", header: "Email", meta: { visible: false } },
          ],
        },
        {
          id: "empty-group",
          header: "Empty Group",
          columns: [
            { accessorKey: "email", header: "Email", meta: { visible: false } },
          ],
        },
      ];
      const result = filterResponsiveColumns(columns);
      expect(result).toHaveLength(1);
      expect((result[0] as any).id).toBe("group");
      expect(((result[0] as any).columns ?? [])).toHaveLength(1);
      expect(((result[0] as any).columns ?? [])[0].accessorKey).toBe("name");
    });

    test("removes group whose own meta.visible is false", () => {
      const columns: ColumnDef<Family, any>[] = [
        {
          id: "group",
          header: "Group",
          meta: { visible: false },
          columns: [{ accessorKey: "name", header: "Name" }],
        },
      ];
      const result = filterResponsiveColumns(columns);
      expect(result).toHaveLength(0);
    });
  });

  describe("resolveHiddenBelowClass", () => {
    const expected: Array<[NTableColumnBreakpoint, string]> = [
      ["sm", "hidden sm:table-cell"],
      ["md", "hidden md:table-cell"],
      ["lg", "hidden lg:table-cell"],
      ["xl", "hidden xl:table-cell"],
      ["2xl", "hidden 2xl:table-cell"],
    ];
    test.each(expected)("hiddenBelow: %s resolves to %s", (bp, expectedClass) => {
      expect(resolveHiddenBelowClass(bp)).toBe(expectedClass);
      expect(hiddenBelowClasses[bp]).toBe(expectedClass);
    });

    test("returns undefined when hiddenBelow is absent", () => {
      expect(resolveHiddenBelowClass(undefined)).toBeUndefined();
    });
  });
});

describe("NTable responsive columns integration", () => {
  test("visible: false removes header and every body cell from loaded table", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", meta: { visible: false } },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    const headers = Array.from(container.querySelectorAll("thead th"));
    const headerTexts = headers.map((h) => h.textContent?.trim());
    expect(headerTexts).toContain("Name");
    expect(headerTexts).not.toContain("Email");

    const cells = Array.from(container.querySelectorAll("tbody td"));
    const cellTexts = cells.map((c) => c.textContent?.trim());
    for (const email of data.map((d) => d.email)) {
      expect(cellTexts).not.toContain(email);
    }
  });

  test("visible: false removes the column from loading markup", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", meta: { visible: false } },
    ];
    const { container } = renderTable(columns, { loading: true });
    await new Promise((r) => setTimeout(r, 50));
    const headers = Array.from(container.querySelectorAll("thead th"));
    const headerTexts = headers.map((h) => h.textContent?.trim());
    expect(headerTexts).toContain("Name");
    expect(headerTexts).not.toContain("Email");
  });

  test("hiddenBelow: lg adds hidden lg:table-cell to its header and all cells", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "email",
        header: "Email",
        meta: { hiddenBelow: "lg" },
      },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    const emailHeaders = Array.from(container.querySelectorAll("thead th")).filter(
      (h) => h.textContent?.trim() === "Email",
    );
    expect(emailHeaders.length).toBe(1);
    expect(emailHeaders[0].className).toContain("hidden");
    expect(emailHeaders[0].className).toContain("lg:table-cell");

    const emailCells = Array.from(container.querySelectorAll("tbody td")).filter(
      (c) => c.textContent?.trim() === "[email protected]" ||
             c.textContent?.trim() === "[email protected]",
    );
    expect(emailCells.length).toBe(2);
    for (const cell of emailCells) {
      expect(cell.className).toContain("hidden");
      expect(cell.className).toContain("lg:table-cell");
    }
  });

  test("a column without meta has no responsive hiding classes", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    const nameHeaders = Array.from(container.querySelectorAll("thead th")).filter(
      (h) => h.textContent?.trim() === "Name",
    );
    expect(nameHeaders[0].className).not.toContain("hidden ");
    expect(nameHeaders[0].className).not.toContain("table-cell");
  });

  test("a different column remains unaffected by a sibling's hiddenBelow", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "guardian", header: "Guardian" },
      { accessorKey: "email", header: "Email", meta: { hiddenBelow: "lg" } },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    const guardianHeaders = Array.from(container.querySelectorAll("thead th")).filter(
      (h) => h.textContent?.trim() === "Guardian",
    );
    expect(guardianHeaders[0].className).not.toContain("table-cell");
    expect(guardianHeaders[0].className).not.toContain("hidden ");
  });

  test("loading skeleton headers and cells receive the same classes", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", meta: { hiddenBelow: "lg" } },
    ];
    const { container } = renderTable(columns, { loading: true });
    await new Promise((r) => setTimeout(r, 50));
    const emailHeaders = Array.from(container.querySelectorAll("thead th")).filter(
      (h) => h.textContent?.trim() === "Email",
    );
    expect(emailHeaders.length).toBe(1);
    expect(emailHeaders[0].className).toContain("hidden");
    expect(emailHeaders[0].className).toContain("lg:table-cell");

    // Each skeleton row has 2 cells (name, email) since checkbox and expansion are off.
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      expect(cells).toHaveLength(2);
      // Second cell is the email column.
      const emailCell = cells[1];
      expect(emailCell.className).toContain("hidden");
      expect(emailCell.className).toContain("lg:table-cell");
    }
  });

  test("visible: false removes the column from the settings menu", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", meta: { visible: false } },
      { accessorKey: "guardian", header: "Guardian" },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    const trigger = container.querySelector("[aria-label='Table settings']") as HTMLElement | null;
    expect(trigger).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
      fireEvent.click(trigger);
      await new Promise((r) => setTimeout(r, 20));
    });
    // The settings menu reads table.getAllColumns(); the filter removes email
    // before TanStack sees it, so the menu won't list email.
    const menuCheckboxes = Array.from(document.querySelectorAll('[role="menuitemcheckbox"]'));
    const labels = menuCheckboxes.map((el) => el.textContent?.trim().toLowerCase());
    expect(labels).not.toContain("email");
    expect(labels).toContain("name");
    expect(labels).toContain("guardian");
  });

  test("a capability change followed by rerender updates the effective columns", async () => {
    function Wrapper() {
      const [canReadEmail, setCanReadEmail] = useState(false);
      const columns: NTableColumnDef<Family>[] = [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email", meta: { visible: canReadEmail } },
      ];
      return (
        <>
          <button data-testid="toggle" onClick={() => setCanReadEmail((v) => !v)}>
            toggle
          </button>
          <NTable<Family>
            data={data}
            columns={columns}
            renderCard={CardRenderer as any}
            dynamicHeight={false}
            showPagination={false}
            showAddButton={false}
            showCheckbox={false}
          />
        </>
      );
    }
    const { container, getByTestId } = render(<Wrapper />);
    await new Promise((r) => setTimeout(r, 50));
    let headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).not.toContain("Email");

    await act(async () => {
      fireEvent.click(getByTestId("toggle"));
      await new Promise((r) => setTimeout(r, 50));
    });
    headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toContain("Email");
  });

  test("plain ColumnDef[] remains assignable to columns", async () => {
    // Source-compatibility contract: ColumnDef<Row, any>[] must compile against
    // NTableProps without requiring NTableColumnDef.
    const plainColumns: ColumnDef<Family, any>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "guardian", header: "Guardian" },
    ];
    const { container } = render(
      <NTable
        data={data}
        columns={plainColumns}
        renderCard={CardRenderer as any}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    const headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toContain("Name");
    expect(headers).toContain("Email");
    expect(headers).toContain("Guardian");
  });

  test("all columns gated does not synthesize an ID fallback column", async () => {
    // When the caller supplied columns and ALL of them are gated by
    // meta.visible === false, no fallback "ID" column should appear.
    const allGated: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name", meta: { visible: false } },
      { accessorKey: "email", header: "Email", meta: { visible: false } },
    ];
    const { container } = render(
      <NTable
        data={data}
        columns={allGated}
        renderCard={CardRenderer as any}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    const headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).not.toContain("ID");
  });

  test("cards do not consume or suppress fields based on responsive metadata", async () => {
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", meta: { visible: false, hiddenBelow: "lg" } },
    ];
    const { container } = render(
      <NTable
        data={data}
        columns={columns}
        renderCard={CardRenderer as any}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        defaultMode="cards"
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    const cards = container.querySelectorAll("[data-testid=card]");
    expect(cards.length).toBe(data.length);
    const emailsRendered = Array.from(
      container.querySelectorAll("[data-testid=card-email]"),
    ).map((el) => el.textContent);
    expect(emailsRendered).toContain("[email protected]");
    expect(emailsRendered).toContain("[email protected]");
  });

  test("manual column visibility hides a still-eligible column", async () => {
    // Open the column settings menu and toggle "Guardian" off. The header
    // should disappear. (TanStack visibility is unaffected by our filtering.)
    const columns: NTableColumnDef<Family>[] = [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "guardian", header: "Guardian" },
    ];
    const { container } = renderTable(columns);
    await new Promise((r) => setTimeout(r, 50));
    let headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toContain("Guardian");

    const trigger = container.querySelector("[aria-label='Table settings']") as HTMLElement | null;
    expect(trigger).toBeTruthy();
    await act(async () => {
      fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
      fireEvent.click(trigger);
      await new Promise((r) => setTimeout(r, 20));
    });

    const guardianItem = Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).find(
      (el) => el.textContent?.trim().toLowerCase() === "guardian",
    ) as HTMLElement | undefined;
    expect(guardianItem).toBeTruthy();
    await act(async () => {
      fireEvent.click(guardianItem);
      await new Promise((r) => setTimeout(r, 50));
    });

    headers = Array.from(container.querySelectorAll("thead th")).map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toContain("Name");
    expect(headers).not.toContain("Guardian");
  });
});

describe("NTable barrel exports", () => {
  test("exports NTableColumnDef, NTableColumnMeta, and NTableColumnBreakpoint", async () => {
    const mod = await import("../../src");
    // Types are erased at runtime, but their type-only import does not throw.
    // Verify the runtime helpers and the component are still exported.
    expect(typeof mod.filterResponsiveColumns).toBe("function");
    expect(typeof mod.resolveHiddenBelowClass).toBe("function");
    expect(mod.hiddenBelowClasses).toBeDefined();
    expect(mod.NTable).toBeDefined();
    // The three type-only exports should be reachable through TypeScript; ensure
    // we can compile a use-site.
    const sample: NTableColumnDef<Family> = {
      accessorKey: "email",
      header: "Email",
      meta: { visible: true, hiddenBelow: "lg" },
    };
    expect(sample.meta?.hiddenBelow).toBe("lg");
    const bp: NTableColumnBreakpoint = "xl";
    expect(bp).toBe("xl");
  });
});

describe("NTableColumnDef TypeScript validation", () => {
  test("valid metadata is accepted", () => {
    const valid: NTableColumnDef<Family> = {
      accessorKey: "email",
      header: "Email",
      meta: { visible: true, hiddenBelow: "lg" },
    };
    expect(valid).toBeDefined();
  });

  test("invalid breakpoint fails TypeScript validation", () => {
    const badBreakpoint: NTableColumnDef<Family> = {
      accessorKey: "email",
      header: "Email",
      meta: {
        // @ts-expect-error hiddenBelow must be one of the supported breakpoints
        hiddenBelow: "xxl",
      },
    };
    expect(badBreakpoint).toBeDefined();
  });

  test("non-boolean visible fails TypeScript validation", () => {
    const badVisible: NTableColumnDef<Family> = {
      accessorKey: "email",
      header: "Email",
      meta: {
        // @ts-expect-error visible must be a boolean when present
        visible: "yes",
      },
    };
    expect(badVisible).toBeDefined();
  });
});
