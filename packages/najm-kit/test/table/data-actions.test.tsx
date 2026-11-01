import { describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import { NTable } from "../../src/components/table/NTable";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";
import { DOWNLOAD_URL_LIFETIME_MS, downloadTable, parseTableImport, printTable, readTableImportFile, tableCsv, tableDataSnapshot, tableFileName, tableXlsx } from "../../src/components/table/dataActions";
import { Xlsx } from "xlsx-manager";

const data = [{ id: "1", name: "Alice" }];
const columns = [{ accessorKey: "name", header: "Name" }];
const base = { data, columns, dynamicHeight: false, showPagination: false, showViewToggle: false, showCheckbox: false };
const importFile = async (view: ReturnType<typeof render>, text: string, name = "rows.json") => {
  fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
  const file = new File([text], name, { type: name.endsWith("json") ? "application/json" : "text/csv" });
  fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [file] } });
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
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [new File(["{}"], "rows.json")] } });
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
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [oldFile] } });
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [new File(['[{"name":"New"}]'], "new.json")] } });
    await waitFor(() => expect(view.getByRole("dialog").textContent).toContain("New"));
    await act(async () => { finish('[{"name":"Old"}]'); });
    expect(view.getByRole("dialog").textContent).toContain("New");
    expect(view.getByRole("dialog").textContent).not.toContain("Old");
  });
});

describe("import dialog layout", () => {
  test("lists expected columns until a file is chosen, then shows the file with its size and rows", async () => {
    const view = render(<NTable {...base} dataActions importColumns={["id", "name"]} />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    const chips = Array.from(document.querySelectorAll("[data-ntable-import-columns] code")).map(chip => chip.textContent);
    expect(chips).toEqual(["id", "name"]);
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [new File(['[{"id":"2","name":"Bob"}]'], "rows.json")] } });
    await waitFor(() => expect(document.querySelector("[data-ntable-import-file]")?.textContent).toContain("1 row"));
    const card = document.querySelector("[data-ntable-import-file]")!;
    expect(card.textContent).toContain("rows.json");
    expect(card.textContent).toContain("25 B");
    expect(document.querySelector("[data-ntable-import-columns]")).toBeNull();
  });

  test("removing the file clears the preview and disables confirmation", async () => {
    const view = render(<NTable {...base} dataActions />);
    await importFile(view, '[{"id":"2","name":"Bob"}]');
    fireEvent.click(view.getByRole("button", { name: "Remove file" }));
    expect(document.querySelector("[data-ntable-import-file]")).toBeNull();
    expect(view.getByRole("dialog").textContent).not.toContain("Bob");
    expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(true);
  });

  test("a file dropped on the zone is read like a chosen one", async () => {
    const view = render(<NTable {...base} dataActions />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    const zone = document.querySelector("[data-ntable-import-dropzone]")!;
    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    expect(zone.getAttribute("data-dragging")).toBe("true");
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['[{"id":"5","name":"Dropped"}]'], "drop.json")] } });
    await waitFor(() => expect(view.getByRole("dialog").textContent).toContain("Dropped"));
    expect(zone.getAttribute("data-dragging")).toBeNull();
  });
});

const xlsxFile = async (fixture = "import.xlsx", filename = fixture) =>
  new File([await Bun.file(new URL("./fixtures/" + fixture, import.meta.url)).arrayBuffer()], filename);

describe("XLSX table imports", () => {
  test("reads the first sheet, preserves Arabic and text codes, and skips empty rows", async () => {
    const rows = await readTableImportFile(await xlsxFile("import.xlsx", "STUDENTS.XLSX"));
    expect(rows).toEqual([
      { id: "001", name: "Ahmed", "Arabic name": "\u0623\u062d\u0645\u062f", user: { phone: "0612345678" }, "Birth date": "2020-01-01T00:00:00.000Z", amount: 12.5, active: true, note: "  keep spaces  " },
      { id: "002", name: "Sara", "Arabic name": "\u0633\u0627\u0631\u0629", user: { phone: null }, "Birth date": null, amount: 2, active: false, note: null },
    ]);
  });

  test("previews XLSX and changes local rows only after confirmation", async () => {
    const view = render(<NTable {...base} dataActions />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    const input = view.getByLabelText("XLSX, CSV or JSON file");
    expect(input.getAttribute("accept")).toContain(".xlsx");
    fireEvent.change(input, { target: { files: [await xlsxFile()] } });
    await waitFor(() => expect(view.getByRole("dialog").textContent).toContain("Ahmed"));
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Replace table data" })); });
    expect(view.queryByRole("dialog")).toBeNull();
    expect(view.container.querySelector("tbody")!.textContent).toContain("Ahmed");
  });

  test("passes XLSX rows to onDataChange without replacing the authoritative data", async () => {
    const onDataChange = mock(async (_rows: unknown) => {});
    const view = render(<NTable {...base} showImportButton onDataChange={onDataChange} />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    const file = await xlsxFile();
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [file] } });
    await waitFor(() => expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(false));
    await act(async () => { fireEvent.click(view.getByRole("button", { name: "Replace table data" })); });
    expect(onDataChange).toHaveBeenCalledWith(await readTableImportFile(file));
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
  });

  test("rejects unsafe headers, header-only sheets and corrupt workbooks", async () => {
    await expect(readTableImportFile(await xlsxFile("import-unsafe.xlsx"))).rejects.toThrow("safe field names");
    await expect(readTableImportFile(await xlsxFile("import-empty.xlsx"))).rejects.toThrow("at least one row");
    await expect(readTableImportFile(new File(["not an Excel archive"], "broken.xlsx"))).rejects.toThrow("valid .xlsx");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("a corrupt XLSX leaves current data intact and confirmation disabled", async () => {
    const view = render(<NTable {...base} dataActions />);
    fireEvent.click(view.container.querySelector('[aria-label="Import"]')!);
    fireEvent.change(view.getByLabelText("XLSX, CSV or JSON file"), { target: { files: [new File(["broken"], "broken.xlsx")] } });
    await waitFor(() => expect(view.getByRole("alert").textContent).toContain("valid .xlsx"));
    expect(view.getByRole("button", { name: "Replace table data" }).hasAttribute("disabled")).toBe(true);
    expect(view.container.querySelector("tbody")!.textContent).toContain("Alice");
  });
});

describe("table data formats", () => {
  test("download creates a CSV file and releases its object URL", async () => {
    let blob!: Blob;
    const createUrl = spyOn(URL, "createObjectURL").mockImplementation(value => { blob = value as Blob; return "blob:table-test"; });
    const revokeUrl = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe("table.csv"); });
    const timers: { run: () => void; delay?: number }[] = [];
    const timeout = spyOn(globalThis, "setTimeout").mockImplementation(((run: () => void, delay?: number) => { timers.push({ run, delay }); return 0; }) as unknown as typeof setTimeout);
    try {
      downloadTable({ headers: ["name"], rows: [["Alice"]] });
      timeout.mockRestore();
      expect(click).toHaveBeenCalledTimes(1);
      expect(blob.type).toBe("text/csv;charset=utf-8");
      expect(await blob.text()).toContain('"Alice"');
      expect(document.querySelector('a[download="table.csv"]')).toBeNull();
      // Revoking right after the click made Chrome save larger files under the blob's UUID.
      expect(revokeUrl).not.toHaveBeenCalled();
      expect(timers.map(timer => timer.delay)).toEqual([DOWNLOAD_URL_LIFETIME_MS]);
      timers[0].run();
      expect(revokeUrl).toHaveBeenCalledWith("blob:table-test");
    } finally { timeout.mockRestore(); createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore(); }
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

  test("labels come from exportHeader or a string header; exportValue and export:false apply to every format", () => {
    const table = createTable({
      data: [{ name: "Alice", status: "active", photo: "a.png", code: 7 }],
      columns: [
        { accessorKey: "name", header: "Nom" },
        { accessorKey: "status", header: () => "Statut", meta: { exportHeader: "Statut", exportValue: (value: string, row: { name: string }) => `${value === "active" ? "Actif" : value} (${row.name})` } },
        { accessorKey: "photo", header: "Photo", meta: { export: false } },
        { accessorKey: "code", header: () => null },
      ],
      state: { columnVisibility: {}, sorting: [], columnFilters: [], globalFilter: "" },
      onStateChange: () => {}, renderFallbackValue: null,
      getCoreRowModel: getCoreRowModel(),
    });
    expect(tableDataSnapshot(table, { labels: true })).toEqual({ headers: ["Nom", "Statut", "code"], rows: [["Alice", "Actif (Alice)", 7]] });
    expect(tableDataSnapshot(table)).toEqual({ headers: ["name", "status", "code"], rows: [["Alice", "Actif (Alice)", 7]] });
  });

  test("file names drop characters file systems reject and keep one extension", () => {
    expect(tableFileName(undefined, "csv")).toBe("table.csv");
    expect(tableFileName('Élèves 2026/27: "6A"', "xlsx")).toBe("Élèves 2026 27 6A.xlsx");
    expect(tableFileName("report.XLSX", "xlsx")).toBe("report.XLSX");
    expect(tableFileName("  ...  ", "csv")).toBe("table.csv");
  });

  test("CSV writes dates as ISO text rather than quoted JSON", () => {
    expect(tableCsv({ headers: ["at"], rows: [[new Date("2026-01-02T00:00:00.000Z")], [new Date("nope")]] })).toBe('﻿"at"\r\n"2026-01-02T00:00:00.000Z"\r\n""');
  });

  test("XLSX keeps labels, types, Arabic text and right-to-left layout, and never writes formulas", async () => {
    const blob = await tableXlsx({
      headers: ["الاسم", "Amount", "Active", "Born", "Note"],
      rows: [["أحمد", 12.5, true, new Date("2020-01-01T00:00:00.000Z"), '=HYPERLINK("x")'], ["Sara", null, false, null, { a: 1 }]],
    }, { title: "Élèves: 6A/B", dir: "rtl" });
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const file = new File([await blob.arrayBuffer()], "export.xlsx");
    const workbook = new Xlsx();
    await workbook.loadWorksheet(file);
    const sheet = workbook.worksheet;
    expect(sheet.name).toBe("Élèves 6A B");
    expect(sheet.views[0]).toMatchObject({ rightToLeft: true, state: "frozen", ySplit: 1 });
    expect(sheet.getRow(1).values).toEqual([undefined, "الاسم", "Amount", "Active", "Born", "Note"]);
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.getCell("A2").value).toBe("أحمد");
    expect(sheet.getCell("B2").value).toBe(12.5);
    expect(sheet.getCell("C2").value).toBe(true);
    expect((sheet.getCell("D2").value as Date).toISOString()).toBe("2020-01-01T00:00:00.000Z");
    expect(sheet.getCell("D2").numFmt).toBe("yyyy-mm-dd");
    expect(sheet.getCell("E2").value).toBe('=HYPERLINK("x")');
    expect(sheet.getCell("E2").formula).toBeUndefined();
    expect(sheet.getCell("E3").value).toBe('{"a":1}');
    expect(sheet.getCell("B3").value).toBeNull();
    expect(sheet.getColumn(1).width).toBeGreaterThanOrEqual(8);
    expect(sheet.autoFilter).toBeTruthy();
    // The exported workbook is one Import accepts back.
    expect(await readTableImportFile(file)).toHaveLength(2);
  });

  test("print uses the page's direction and language, a title heading and localized dates", () => {
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
      const born = new Date("2020-01-15T00:00:00.000Z");
      printTable({ headers: ["الاسم", "Born"], rows: [["أحمد", born]] }, { title: "Élèves", dir: "rtl", lang: "ar" });
      const doc = frame.contentDocument!;
      expect(doc.documentElement.dir).toBe("rtl");
      expect(doc.documentElement.lang).toBe("ar");
      expect(doc.title).toBe("Élèves");
      expect(doc.querySelector("h1")!.textContent).toBe("Élèves");
      expect(doc.querySelectorAll("td")[1].textContent).toBe(born.toLocaleDateString("ar"));
    } finally { create.mockRestore(); appendSpy.mockRestore(); frame.remove(); }
  });
});

describe("export toolbar", () => {
  const capture = () => {
    const files: { name: string; blob: Blob }[] = [];
    let pending: Blob | undefined;
    const createUrl = spyOn(URL, "createObjectURL").mockImplementation(value => { pending = value as Blob; return "blob:table-test"; });
    const revokeUrl = spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { files.push({ name: this.download, blob: pending! }); });
    return { files, restore: () => { createUrl.mockRestore(); revokeUrl.mockRestore(); click.mockRestore(); } };
  };
  const labelled = [{ accessorKey: "name", header: "Nom" }];

  test("Export opens a format menu; Excel downloads a labelled workbook named after exportTitle", async () => {
    const download = capture();
    try {
      const view = render(<NTable {...base} columns={labelled} dataActions exportTitle="Élèves" />);
      const button = view.container.querySelector('[aria-label="Export"]')!;
      expect(button.getAttribute("aria-haspopup")).toBe("menu");
      fireEvent.click(button);
      fireEvent.click(await view.findByText("Excel (.xlsx)"));
      await waitFor(() => expect(download.files).toHaveLength(1));
      expect(download.files[0].name).toBe("Élèves.xlsx");
      const workbook = new Xlsx();
      await workbook.loadWorksheet(new File([await download.files[0].blob.arrayBuffer()], "x.xlsx"));
      expect(workbook.worksheet.getRow(1).values).toEqual([undefined, "Nom"]);
      expect(workbook.worksheet.getCell("A2").value).toBe("Alice");
    } finally { download.restore(); }
  });

  test("CSV keeps field names so Import reads it back", async () => {
    const download = capture();
    try {
      const view = render(<NTable {...base} columns={labelled} dataActions />);
      fireEvent.click(view.container.querySelector('[aria-label="Export"]')!);
      fireEvent.click(await view.findByText("CSV (.csv)"));
      expect(download.files[0].name).toBe("table.csv");
      expect(await download.files[0].blob.text()).toBe('﻿"name"\r\n"Alice"');
    } finally { download.restore(); }
  });

  test("one export format exports directly; labels come from toolbarLabels; onExport still overrides", async () => {
    const download = capture();
    try {
      const view = render(<NTable {...base} columns={labelled} dataActions exportFormats={["csv"]} toolbarLabels={{ export: "Exporter" }} />);
      const button = view.container.querySelector('[aria-label="Exporter"]')!;
      expect(button.getAttribute("aria-haspopup")).toBeNull();
      fireEvent.click(button);
      expect(download.files.map(file => file.name)).toEqual(["table.csv"]);
      const onExport = mock();
      view.rerender(<NTable {...base} columns={labelled} dataActions onExport={onExport} toolbarLabels={{ exportXlsx: "Classeur" }} />);
      fireEvent.click(view.container.querySelector('[aria-label="Export"]')!);
      expect(onExport).toHaveBeenCalledTimes(1);
      expect(view.queryByText("Classeur")).toBeNull();
    } finally { download.restore(); }
  });
});
