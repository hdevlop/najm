import { describe, test, expect } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColumnDef } from "@tanstack/react-table";

import { NTable, type NTableProps } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
  age: number;
}

const sampleData: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
  { id: "3", name: "Charlie", age: 35 },
];

const sampleColumns: ColumnDef<Row, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

function TableWrapper(props: Partial<NTableProps<Row>>) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={sampleData}
        columns={sampleColumns}
        dynamicHeight={false}
        showPagination={false}
        showAddButton={false}
        showCheckbox={false}
        {...props}
      />
    </div>
  );
}

function getButtonByLabel(container: HTMLElement, label: string): HTMLElement | null {
  const all = container.querySelectorAll("[aria-label]");
  for (const el of all) {
    if (el.getAttribute("aria-label")?.toLowerCase().includes(label.toLowerCase())) {
      return el as HTMLElement;
    }
  }
  return null;
}

describe("NTable JSON mode", () => {
  test("renders JsonViewer when mode=json and jsonValue is provided", () => {
    const jsonData = { name: "Alice", age: 30 };
    const { container } = render(
      <TableWrapper
        mode="json"
        jsonValue={jsonData}
        showViewToggle={true}
      />
    );
    // JsonViewer renders a CodeMirror editor
    const editor = container.querySelector(".cm-editor");
    expect(editor).toBeTruthy();
  });

  test("renders custom renderJson when provided in JSON mode", () => {
    const { container } = render(
      <TableWrapper
        mode="json"
        jsonValue={{ foo: "bar" }}
        renderJson={() => <div data-testid="custom-json">Custom JSON View</div>}
        showViewToggle={true}
      />
    );
    const el = container.querySelector("[data-testid='custom-json']");
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe("Custom JSON View");
  });

  test("hides pagination in JSON mode", () => {
    const { container } = render(
      <TableWrapper
        mode="json"
        jsonValue={{ test: true }}
        showViewToggle={true}
        showPagination={true}
      />
    );
    // In JSON mode, pagination controls should not render at all.
    // Check for a pagination button (ChevronRight icon used in pagination)
    const paginationButtons = container.querySelectorAll("button");
    const hasPaginationButton = Array.from(paginationButtons).some(btn => {
      const html = btn.innerHTML;
      return html.includes("ChevronRight") || html.includes("ChevronsLeft") || html.includes("ChevronsRight");
    });
    expect(hasPaginationButton).toBe(false);
  });

  test("JSON toggle button is hidden when neither jsonValue nor renderJson is provided", () => {
    const { container } = render(
      <TableWrapper showViewToggle={true} />
    );
    // No JSON button should be present without jsonValue
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeNull();
  });

  test("JSON toggle button appears when jsonValue is provided", () => {
    const { container } = render(
      <TableWrapper jsonValue={{ test: true }} showViewToggle={true} />
    );
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeTruthy();
  });
});

describe("NTable controlled mode", () => {
  test("controlled mode does not mutate view when mode prop is provided", () => {
    let calledWith: "table" | "cards" | "json" | null = null;
    const onModeChange = (mode: "table" | "cards" | "json") => { calledWith = mode; };

    const { container } = render(
      <TableWrapper
        mode="table"
        onModeChange={onModeChange}
        showViewToggle={true}
        jsonValue={{ test: true }}
      />
    );

    // Click JSON button (controlled mode)
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeTruthy();
    fireEvent.click(jsonBtn);

    // onModeChange should have been called
    expect(calledWith).toBe("json");

    // The table should still be visible (mode didn't change internally)
    const tableEl = container.querySelector("table");
    expect(tableEl).toBeTruthy();
  });

  test("uncontrolled mode changes visible view and calls onModeChange", () => {
    let calledWith: "table" | "cards" | "json" | null = null;
    const onModeChange = (mode: "table" | "cards" | "json") => { calledWith = mode; };

    const { container } = render(
      <TableWrapper
        defaultMode="table"
        onModeChange={onModeChange}
        showViewToggle={true}
        jsonValue={{ test: true }}
      />
    );

    // Click JSON button
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeTruthy();
    fireEvent.click(jsonBtn);

    // onModeChange should have been called
    expect(calledWith).toBe("json");

    // The visible view should also have changed (table content should be hidden)
    const tableEl = container.querySelector("table");
    expect(tableEl).toBeNull();
  });

  test("rendering with mode=json shows JSON view directly", () => {
    const { container } = render(
      <TableWrapper
        mode="json"
        jsonValue={{ name: "Alice" }}
        showViewToggle={true}
      />
    );
    // Should show the JsonViewer (cm-editor)
    const editor = container.querySelector(".cm-editor");
    expect(editor).toBeTruthy();
    // Table should not be visible
    const tableEl = container.querySelector("table");
    expect(tableEl).toBeNull();
  });
});

describe("NTable availableModes", () => {
  test("availableModes={['table']} hides cards and json buttons", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table"] as const}
        renderCard={() => <div>Card</div>}
        jsonValue={{ test: true }}
      />
    );

    // Cards button should be hidden
    const cardsBtn = getButtonByLabel(container, "cards");
    expect(cardsBtn).toBeNull();
    // JSON button should be hidden
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeNull();
    // Table button should be visible
    const tableBtn = getButtonByLabel(container, "table");
    expect(tableBtn).toBeTruthy();
  });

  test("availableModes={['table', 'json'] hides cards button", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table", "json"] as const}
        renderCard={() => <div>Card</div>}
        jsonValue={{ test: true }}
      />
    );

    // Cards button should be hidden
    const cardsBtn = getButtonByLabel(container, "cards");
    expect(cardsBtn).toBeNull();
    // JSON button should be visible
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeTruthy();
    // Table button should be visible
    const tableBtn = getButtonByLabel(container, "table");
    expect(tableBtn).toBeTruthy();
  });

  test("user action does not emit mode outside availableModes", () => {
    let emittedModes: ("table" | "cards" | "json")[] = [];
    const onModeChange = (mode: "table" | "cards" | "json") => { emittedModes.push(mode); };

    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table", "json"] as const}
        defaultMode="table"
        onModeChange={onModeChange}
        renderCard={() => <div>Card</div>}
        jsonValue={{ test: true }}
      />
    );

    // Cards button should not be in availableModes, so it shouldn't exist
    const cardsBtn = getButtonByLabel(container, "cards");
    expect(cardsBtn).toBeNull();

    // Click table button - should work
    const tableBtn = getButtonByLabel(container, "table");
    expect(tableBtn).toBeTruthy();
    fireEvent.click(tableBtn);
    expect(emittedModes).toContain("table");
    expect(emittedModes).not.toContain("cards");
  });

  test("cards button hidden when renderCard not provided even if availableModes includes cards", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table", "cards", "json"] as const}
        jsonValue={{ test: true }}
      />
    );
    // Cards button should be hidden because renderCard is not provided
    const cardsBtn = getButtonByLabel(container, "cards");
    expect(cardsBtn).toBeNull();
  });

  test("json button hidden when neither jsonValue nor renderJson provided even if availableModes includes json", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table", "cards", "json"] as const}
      />
    );
    // JSON button should be hidden because no jsonValue or renderJson
    const jsonBtn = getButtonByLabel(container, "json");
    expect(jsonBtn).toBeNull();
  });

  test("cards button visible when renderCard is provided and availableModes includes cards", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        availableModes={["table", "cards", "json"] as const}
        renderCard={() => <div>Card</div>}
        jsonValue={{ test: true }}
      />
    );
    // Cards button should be visible because renderCard is provided
    const cardsBtn = getButtonByLabel(container, "cards");
    expect(cardsBtn).toBeTruthy();
  });

  test("files button is hidden by default", () => {
    const { container } = render(
      <TableWrapper
        showViewToggle={true}
        jsonValue={{ test: true }}
      />
    );
    const filesBtn = getButtonByLabel(container, "files");
    expect(filesBtn).toBeNull();
  });

  test("custom files mode renders custom content without table content", () => {
    const { container } = render(
      <TableWrapper
        mode="files"
        showViewToggle={true}
        showPagination={true}
        availableModes={["table", "json", "files"] as const}
        jsonValue={{ test: true }}
        renderCustomMode={{
          files: () => <div data-testid="files-view">Files View</div>,
        }}
      />
    );

    expect(container.querySelector("[data-testid='files-view']")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });

  test("controlled unavailable mode normalizes to first available mode", () => {
    let calledWith: "table" | null = null;

    render(
      <TableWrapper
        mode={"files" as any}
        availableModes={["table"] as const}
        onModeChange={(mode: any) => { calledWith = mode; }}
      />
    );

    expect(calledWith).toBe("table");
  });
});
