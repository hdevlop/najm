import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1),
  name: `User ${index + 1}`,
}));

const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Name" }];

function renderTable(props: Partial<NTableProps<Row>> = {}) {
  return render(
    <div style={{ height: 600 }}>
      <NTable
        data={rows}
        columns={columns}
        dynamicHeight={false}
        showPagination
        showAddButton={false}
        showCheckbox={false}
        showViewToggle={false}
        {...props}
      />
    </div>,
  );
}

/** The page buttons, in rendered order. */
function pageButtons(container: HTMLElement) {
  return [...container.querySelectorAll("nav [aria-label]")]
    .filter((element) => /^(Go to page|Page) \d+/.test(element.getAttribute("aria-label") ?? ""))
    .map((element) => element.textContent?.trim());
}

function buttonForPage(container: HTMLElement, page: number) {
  return [...container.querySelectorAll("nav [aria-label]")].find((element) => {
    const label = element.getAttribute("aria-label") ?? "";
    return label === `Go to page ${page}` || label.startsWith(`Page ${page},`);
  }) as HTMLElement | undefined;
}

describe("numbered pagination", () => {
  test("renders a page button per page instead of the position text", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual(["1", "2", "3", "4"]);
  });

  test("the current page is marked for assistive technology", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 2, pageSize: 10 },
      onPaginationChange: () => {},
    });

    const current = container.querySelector('[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe("3");
  });

  test("clicking a page reports that page to the application", () => {
    const seen: Array<{ pageIndex: number; pageSize: number }> = [];
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 8,
      rowCount: 80,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: (next) => seen.push(next),
    });

    fireEvent.click(buttonForPage(container, 8)!);

    expect(seen).toEqual([{ pageIndex: 7, pageSize: 10 }]);
  });

  test("the last page is one click away, so the double chevrons are dropped", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 8,
      rowCount: 80,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(buttonForPage(container, 8)).toBeTruthy();
    expect(container.querySelector('[aria-label="First page"]')).toBeNull();
    expect(container.querySelector('[aria-label="Last page"]')).toBeNull();
    // Previous and next remain: they are the fast path for reading in order.
    expect(container.querySelector('[aria-label="Previous"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();
  });

  test("a long result collapses to a fixed set of slots with gaps", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 20,
      rowCount: 200,
      pagination: { pageIndex: 9, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual(["1", "9", "10", "11", "20"]);
  });

  test("compact keeps the position text and all four chevrons", () => {
    const { container } = renderTable({
      paginationVariant: "compact",
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual([]);
    expect(container.textContent).toContain("Page 1 of 4");
    expect(container.querySelector('[aria-label="First page"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Last page"]')).toBeTruthy();
  });

  test("a manual list with no page count falls back rather than inviting bad clicks", () => {
    // Without a real result total there is nothing honest to number, so the
    // numbered variant must not render buttons for pages that may not exist.
    const { container } = renderTable({
      manualPagination: true,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual([]);
    expect(container.querySelector('[aria-label="Last page"]')).toBeTruthy();
  });

  test("hasNextPage numbers the known pages and qualifies the rest", () => {
    // The whole point of the trailing gap: on page one the reader is already
    // told the result runs past page two, so meeting page three is expected.
    const { container } = renderTable({
      manualPagination: true,
      hasNextPage: true,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual(["1", "2"]);
    expect(container.querySelector("nav")?.textContent).toContain("…");
    // No known last page, so no jump to one.
    expect(container.querySelector('[aria-label="Last page"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="Next"]')?.hasAttribute("disabled"),
    ).toBe(false);
  });

  test("the end of an untotalled result stops being provisional", () => {
    const { container } = renderTable({
      manualPagination: true,
      hasNextPage: false,
      pagination: { pageIndex: 2, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual(["1", "2", "3"]);
    expect(container.querySelector("nav")?.textContent).not.toContain("…");
    expect(
      container.querySelector('[aria-label="Next"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("a real pageCount wins over hasNextPage", () => {
    // A total says everything hasNextPage says and more, so it is not qualified.
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 4,
      hasNextPage: true,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(pageButtons(container)).toEqual(["1", "2", "3", "4"]);
    expect(container.querySelector("nav")?.textContent).not.toContain("…");
  });

  test("compact states the page without inventing a total", () => {
    const { container } = renderTable({
      paginationVariant: "compact",
      manualPagination: true,
      hasNextPage: true,
      pagination: { pageIndex: 1, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(container.textContent).toContain("Page 2");
    expect(container.textContent).not.toContain("Page 2 of");
    // There is no last page to jump to, so the control is not offered.
    expect(
      container.querySelector('[aria-label="Last page"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });

  test("a pageCount that grows with the page index is called out in development", () => {
    // The kafil `pageIndex + 2` shape: a cursor bound wearing a total's prop.
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };

    try {
      const view = renderTable({
        manualPagination: true,
        pageCount: 2,
        pagination: { pageIndex: 0, pageSize: 10 },
        onPaginationChange: () => {},
      });
      view.rerender(
        <div style={{ height: 600 }}>
          <NTable
            data={rows}
            columns={columns}
            dynamicHeight={false}
            showPagination
            showAddButton={false}
            showCheckbox={false}
            showViewToggle={false}
            manualPagination
            pageCount={3}
            pagination={{ pageIndex: 1, pageSize: 10 }}
            onPaginationChange={() => {}}
          />
        </div>,
      );
    } finally {
      console.warn = original;
    }

    expect(warnings.some((line) => line.includes("pass hasNextPage instead"))).toBe(true);
  });

  test("a real total that changes under the reader is not mistaken for a bound", () => {
    // Filtering resets to page one and moves the count; a deletion moves the
    // count without moving the page. Neither is the lockstep signature.
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };

    try {
      const view = renderTable({
        manualPagination: true,
        pageCount: 20,
        pagination: { pageIndex: 3, pageSize: 10 },
        onPaginationChange: () => {},
      });
      view.rerender(
        <div style={{ height: 600 }}>
          <NTable
            data={rows}
            columns={columns}
            dynamicHeight={false}
            showPagination
            showAddButton={false}
            showCheckbox={false}
            showViewToggle={false}
            manualPagination
            pageCount={21}
            pagination={{ pageIndex: 4, pageSize: 10 }}
            onPaginationChange={() => {}}
          />
        </div>,
      );
    } finally {
      console.warn = original;
    }

    // The movement is in lockstep, but page 5 of 21 is nowhere near the end —
    // a bound is always within a page of the reader, so this is a real total.
    expect(warnings).toEqual([]);
  });

  test("labels are localizable", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 3,
      rowCount: 30,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
      paginationLabels: {
        rowsPerPage: "Lignes/page",
        pagination: "Pagination des résultats",
        goToPage: (page) => `Aller à la page ${page}`,
        currentPage: (page) => `Page ${page}, page actuelle`,
        nextPage: "Suivant",
        previousPage: "Précédent",
        rowsSelected: (selected, total) => `${selected} sur ${total} ligne(s) sélectionnée(s).`,
      },
    });

    expect(container.textContent).toContain("Lignes/page");
    expect(container.querySelector('[aria-label="Pagination des résultats"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Aller à la page 2"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Suivant"]')).toBeTruthy();
    expect(container.textContent).toContain("ligne(s) sélectionnée(s).");
  });

  test("the page control group is a labelled landmark", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("Pagination");
  });

  test("previous is disabled on the first page and next on the last", () => {
    const first = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });
    expect(
      first.container.querySelector('[aria-label="Previous"]')?.hasAttribute("disabled"),
    ).toBe(true);

    const last = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 3, pageSize: 10 },
      onPaginationChange: () => {},
    });
    expect(
      last.container.querySelector('[aria-label="Next"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("inherited pagination labels", () => {
  function renderInProvider(
    defaults: Parameters<typeof NTableDefaultsProvider>[0]["value"],
    props: Partial<NTableProps<Row>> = {},
  ) {
    return render(
      <NTableDefaultsProvider value={defaults}>
        <div style={{ height: 600 }}>
          <NTable
            data={rows}
            columns={columns}
            dynamicHeight={false}
            showPagination
            showAddButton={false}
            showCheckbox={false}
            showViewToggle={false}
            manualPagination
            pageCount={4}
            rowCount={40}
            pagination={{ pageIndex: 0, pageSize: 10 }}
            onPaginationChange={() => {}}
            {...props}
          />
        </div>
      </NTableDefaultsProvider>,
    );
  }

  test("a table with no labels of its own inherits the provider's", () => {
    const { container } = renderInProvider({
      paginationLabels: {
        rowsPerPage: "Lignes/page",
        goToPage: (page) => `Aller à la page ${page}`,
        nextPage: "Suivant",
      },
    });

    expect(container.textContent).toContain("Lignes/page");
    expect(container.querySelector('[aria-label="Aller à la page 2"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Suivant"]')).toBeTruthy();
  });

  test("a table's own label wins for that key and keeps the rest", () => {
    const { container } = renderInProvider(
      {
        paginationLabels: {
          rowsPerPage: "Lignes/page",
          nextPage: "Suivant",
          previousPage: "Précédent",
        },
      },
      { paginationLabels: { nextPage: "Page suivante" } },
    );

    expect(container.querySelector('[aria-label="Page suivante"]')).toBeTruthy();
    // The keys the table did not override still come from the provider.
    expect(container.querySelector('[aria-label="Précédent"]')).toBeTruthy();
    expect(container.textContent).toContain("Lignes/page");
  });

  test("a label neither side supplies falls back to the packaged English", () => {
    const { container } = renderInProvider({
      paginationLabels: { rowsPerPage: "Lignes/page" },
    });

    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Pagination"]')).toBeTruthy();
  });

  test("no provider leaves the packaged English in place", () => {
    const { container } = renderTable({
      manualPagination: true,
      pageCount: 4,
      rowCount: 40,
      pagination: { pageIndex: 0, pageSize: 10 },
      onPaginationChange: () => {},
    });

    expect(container.textContent).toContain("Rows/page");
    expect(container.querySelector('[aria-label="Next"]')).toBeTruthy();
  });
});
