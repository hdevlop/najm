import { describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";
import { downloadTable, parseTableImport, printTable, tableCsv, tableDataSnapshot } from "../../src/components/table/dataActions";

const data = [{ id: "1", name: "Alice" }];
const columns = [{ accessorKey: "name", header: "Name" }];
const base = { data, columns, dynamicHeight: false, showPagination: false, showViewToggle: false, showCheckbox: false };
const importFile = async (view: ReturnType<typeof render>, text: string, name = "rows.json") => {
  fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
  const file = new File([text], name, { type: name.endsWith("json") ? "application/json" : "text/csv" });
  fireEvent.change(view.getByLabelText("CSV or JSON file"), { target: { files: [file] } });
  await waitFor(() => expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(false));
};

describe("default table data workflows", () => {
  test("enables all actions with one prop or an inherited default", () => {
    const view = render(<NTableDefaultsProvider value={{ dataActions: true }}><NTable {...base} /></NTableDefaultsProvider>);
    for (const label of ["Export", "Import", "Print"]) expect(view.container.querySelector(`[aria-label="${label}"]`)).toBeTruthy();
    view.rerender(<NTableDefaultsProvider value={{ dataActions: true }}><NTable {...base} dataActions={false} /></NTableDefaultsProvider>);
    expect(view.container.querySelector('[aria-label="Import"]')).toBeNull();
  });

  test("previews JSON and replaces local rows only after confirmation; parent data wins", async () => {
    const view = render(<NTable {...base} dataActions />);
    await importFile(view, '[{"id":"2","name":"Bob"}]');
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
    expect(view.getByRole("dialog").textContent).toContain("Bob");
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Replace table data" })); });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.container.querySelector("tbody")!.textContent).toContain("Bob");
    expect(data[0].name).toBe("Alice");
    view.rerender(<NTable {...base} data={[{ id: "3", name: "Carol" }]} dataActions />);
    expect(view.container.querySelector("tbody")!.textContent).toContain("Carol");
  });

  test("CSV import works on an empty table and cancellation leaves it empty", async () => {
    const view = render(<NTable {...base} data={[]} isEmpty dataActions getRowId={row => row.id} />);
    await importFile(view, 'id,name\r\n2,"Bob, Jr."', "rows.csv");
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    expect(view.container.textContent).toContain("No data available");
    await importFile(view, 'id,name\r\n2,"Bob, Jr."', "rows.csv");
    fireEvent.click(view.getByRole("button", { name: "Replace table data" }));
    await waitFor(() => expect(view.container.querySelector("tbody")?.textContent).toContain("Bob, Jr."));
    expect(view.container.querySelector('tbody [data-row]')?.getAttribute("data-row-id")).toBe("0");
  });

  test("onDataChange receives parsed rows, waits for saving and permits retry after failure", async () => {
    const onDataChange = mock(async () => { throw new Error("Could not save rows"); });
    const view = render(<NTable {...base} dataActions onDataChange={onDataChange} />);
    await importFile(view, '[{"id":"2","name":"Bob"}]');
    fireEvent.click(view.getByRole("button", { name: "Replace table data" }));
    await waitFor(() => expect(view.getByRole("alert").textContent).toBe("Could not save rows"));
    expect(onDataChange).toHaveBeenCalledWith([{ id: "2", name: "Bob" }]);
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
    expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(false);
  });

  test("invalid files report errors without touching displayed data", async () => {
    const view = render(<NTable {...base} dataActions />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    fireEvent.change(view.getByLabelText("CSV or JSON file"), { target: { files: [new File(["{}"], "rows.json")] } });
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("array of row objects"));
    expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(true);
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
  });

  test("custom import overrides the default dialog", () => {
    const onImport = mock();
    const view = render(<NTable {...base} dataActions onImport={onImport} />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(view.queryByRole("dialog")).toBeNull();
  });

  test("onDataChange blocks duplicate confirmation and waits for the app's authoritative rows", async () => {
    let finish!: () => void;
    const onDataChange = mock(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = render(<NTable {...base} dataActions onDataChange={onDataChange} />);
    await importFile(view, '[{"id":"2","name":"Bob"}]');
    const confirm = view.getByRole("button", { name: "Replace table data" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onDataChange).toHaveBeenCalledTimes(1);
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(view.getByRole("dialog")).toBeTruthy();
    await act(async () => { finish(); });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
    view.rerender(<NTable {...base} dataActions data={[{ id: "2", name: "Saved Bob" }]} onDataChange={onDataChange} />);
    expect(view.container.querySelector("tbody")!.textContent).toContain("Saved Bob");
  });

  test("local import switches a server table to local pagination without fetching remote pages", async () => {
    const onPaginationChange = mock();
    const view = render(<NTable {...base} dataActions manualPagination rowCount={500} pagination={{ pageIndex: 3, pageSize: 1 }} onPaginationChange={onPaginationChange} showPagination />);
    await importFile(view, '[{"id":"2","name":"Bob"},{"id":"3","name":"Carol"}]');
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Replace table data" })); });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.container.querySelector("tbody")!.textContent).toContain("Bob");
    expect(onPaginationChange).not.toHaveBeenCalled();
  });

  test("ignores a stale file read after another file is selected", async () => {
    let finish!: (value: string) => void;
    const oldFile = { name: "old.json", text: () => new Promise<string>(resolve => { finish = resolve; }) };
    const view = render(<NTable {...base} dataActions />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    fireEvent.change(view.getByLabelText("CSV or JSON file"), { target: { files: [oldFile] } });
    fireEvent.change(view.getByLabelText("CSV or JSON file"), { target: { files: [new File(['[{"name":"New"}]'], "new.json")] } });
    await waitFor(() => expect(view.getByRole("dialog").textContent).toContain("New"));
    await act(async () => { finish('[{"name":"Old"}]'); });
    expect(view.getByRole("dialog").textContent).toContain("New");
    expect(view.getByRole("dialog").textContent).not.toContain("Old");
  });
});

describe("table data formats", () => {
  test("download creates a CSV file and releases its object URL", async () => {
    let blob!: Blob;
    const createUrl = spyOn(URL, "createObjectURL").mockImplementation(value => { blob = value as Blob; return "blob:table-test"; });
    const revokeUrl = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe("table.csv"); });
    try {
      downloadTable({ headers: ["name"], rows: [["Alice"]] });
      expect(click).toHaveBeenCalledTimes(1);
      expect(blob.type).toBe("text/csv;charset=utf-8");
      expect(await blob.text()).toContain('"Alice"');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(revokeUrl).toHaveBeenCalledWith("blob:table-test");
      expect(document.querySelector('a[download="table.csv"]')).toBeNull();
    } finally { createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore(); }
  });

  test("print builds a separate table with escaped text and cleans up after printing", () => {
    const frame = document.createElement("iframe");
    const print = mock();
    const append = document.body.append.bind(document.body);
    const appendSpy = spyOn(document.body, "append").mockImplementation((...nodes) => {
      append(...nodes);
      if (nodes.includes(frame)) Object.defineProperty(frame.contentWindow!, "print", { configurable: true, value: print });
    });
    const createElement = document.createElement.bind(document);
    const create = spyOn(document, "createElement").mockImplementation(((tag: string) => tag === "iframe" ? frame : createElement(tag)) as typeof document.createElement);
    try {
      printTable({ headers: ["name"], rows: [['<script>alert("x")</script>']] });
      expect(print).toHaveBeenCalledTimes(1);
      expect(frame.contentDocument!.querySelector("script")).toBeNull();
      expect(frame.contentDocument!.querySelector("td")!.textContent).toBe('<script>alert("x")</script>');
      frame.contentWindow!.dispatchEvent(new Event("afterprint"));
      expect(frame.isConnected).toBe(false);
    } finally { create.mockRestore(); appendSpy.mockRestore(); frame.remove(); }
  });

  test("JSON preserves nested values, numeric types and booleans", () => {
    expect(parseTableImport('[{"amount":12,"active":true,"user":{"name":"Alice"}}]', "ROWS.JSON")).toEqual([{ amount: 12, active: true, user: { name: "Alice" } }]);
  });

  test("CSV accepts BOM, quoted commas, quotes, CRLF, multiline values and dotted fields", () => {
    expect(parseTableImport('\uFEFFid,user.name,note\r\n001,"Bob, Jr.","said ""Hi""\nagain"\r\n', "rows.csv")).toEqual([{ id: "001", user: { name: "Bob, Jr." }, note: 'said "Hi"\nagain' }]);
    expect(parseTableImport('a,b\n,\n', "rows.csv")).toEqual([{ a: "", b: "" }]);
  });

  test("rejects malformed files and unsafe or conflicting headers", () => {
    for (const input of ['a,a\n1,2', 'a,b\n1', 'a\n"unclosed', 'a\n"closed"junk', '__proto__.polluted\ntrue', 'constructor\ntrue', 'user,user.name\nx,y']) expect(() => parseTableImport(input, "rows.csv")).toThrow();
    for (const input of ['[]', '[1]', '[null]', '[{"__proto__":{"polluted":true}}]', '[{"user":{"constructor":1}}]']) expect(() => parseTableImport(input, "rows.json")).toThrow();
    expect(() => parseTableImport("", "rows.csv")).toThrow();
    expect(() => parseTableImport("abc", "rows.xlsx")).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("CSV escaping prevents formulas in text while preserving numeric values", () => {
    expect(tableCsv({ headers: ["name", "amount"], rows: [['=HYPERLINK("x")', -3], ["line\ntext", 2]] })).toBe('\uFEFF"name","amount"\r\n"\'=HYPERLINK(""x"")","-3"\r\n"line\ntext","2"');
  });

  test("exports accessor columns and loaded filtered/sorted rows, excluding hidden and action columns", () => {
    const table = createTable({
      data: [{ name: "Bob", secret: "private" }, { name: "Alice", secret: "private" }],
      columns: [{ accessorKey: "name" }, { accessorKey: "secret" }, { id: "actions" }],
      state: { columnVisibility: { secret: false }, sorting: [{ id: "name", desc: false }], columnFilters: [], globalFilter: "" },
      onStateChange: () => {}, renderFallbackValue: null,
      getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(),
    });
    expect(tableDataSnapshot(table)).toEqual({ headers: ["name"], rows: [["Alice"], ["Bob"]] });
  });
});
