import type { Column, Table } from "@tanstack/react-table";
import type { NTableColumnMeta } from "./responsiveColumns";

export interface TableDataSnapshot {
  headers: string[];
  rows: unknown[][];
}

/** Built-in export formats. XLSX and print are for people; CSV and JSON keep field names so Import reads them back. */
export type NTableExportFormat = "xlsx" | "csv" | "json";

export interface TableSnapshotOptions {
  /** Column labels (`meta.exportHeader`, else a string `header`) instead of field names. */
  labels?: boolean;
}

/** Where an exported or printed table is read: its title, writing direction and language. */
export interface TableDocumentOptions {
  /** File name without extension, sheet name and printed heading. */
  title?: string;
  dir?: "ltr" | "rtl";
  lang?: string;
}

const columnMeta = (column: Column<any, unknown>) => column.columnDef.meta as NTableColumnMeta | undefined;
const columnKey = (column: Column<any, unknown>) => (column.columnDef as { accessorKey?: string }).accessorKey ?? column.id;

function columnLabel(column: Column<any, unknown>): string {
  const label = columnMeta(column)?.exportHeader ?? column.columnDef.header;
  return typeof label === "string" && label.trim() ? label : columnKey(column);
}

/** Accessor columns only, honoring column eligibility, visibility, `meta.export`, filters and sorting. */
export function tableDataSnapshot(table: Table<any>, { labels = false }: TableSnapshotOptions = {}): TableDataSnapshot {
  const columns = table.getVisibleLeafColumns().filter(column => column.accessorFn && columnMeta(column)?.export !== false);
  return {
    headers: columns.map(column => labels ? columnLabel(column) : columnKey(column)),
    rows: table.getPrePaginationRowModel().rows.map(row => columns.map(column => {
      const value = row.getValue(column.id);
      const exportValue = columnMeta(column)?.exportValue;
      return exportValue ? exportValue(value, row.original) : value;
    })),
  };
}

/** The page's own direction and language, which an exported or printed copy keeps. */
export function documentContext(): Pick<TableDocumentOptions, "dir" | "lang"> {
  if (typeof document === "undefined") return {};
  const root = document.documentElement;
  return { dir: root.getAttribute("dir") === "rtl" ? "rtl" : "ltr", lang: root.lang || undefined };
}

const validDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

export function dataCellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return validDate(value) ? value.toISOString() : "";
  if (typeof value === "object") {
    try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
  }
  return String(value);
}

export function tableCsv(snapshot: TableDataSnapshot): string {
  const encode = (value: unknown) => {
    let text = dataCellText(value);
    // Keep spreadsheet programs from treating untrusted text as a formula.
    if (typeof value !== "number" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [snapshot.headers, ...snapshot.rows].map(row => row.map(encode).join(",")).join("\r\n");
}

/** A name every file system accepts, with the format's extension. */
export function tableFileName(title: string | undefined, extension: string): string {
  // eslint-disable-next-line no-control-regex
  const base = (title ?? "").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "") || "table";
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

/**
 * How long a download's object URL outlives the click. Chrome reads the blob,
 * and the `download` name with it, after the click returns; revoked sooner,
 * a larger file such as a workbook saves under the blob's UUID with no extension.
 */
export const DOWNLOAD_URL_LIFETIME_MS = 40_000;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

export function downloadTable(snapshot: TableDataSnapshot, title?: string) {
  downloadBlob(new Blob([tableCsv(snapshot)], { type: "text/csv;charset=utf-8" }), tableFileName(title, "csv"));
}

/**
 * One object per row, keyed by field name, the shape JSON import reads back:
 * dotted fields (`user.name`) become nested objects and values keep their
 * types (dates as ISO text).
 */
export function tableJson(snapshot: TableDataSnapshot): string {
  const rows = snapshot.rows.map(values => {
    const row: Record<string, unknown> = {};
    snapshot.headers.forEach((key, index) => {
      const path = key.split(".");
      let target = row;
      for (const part of path.slice(0, -1)) {
        const next = target[part];
        target = (next && typeof next === "object" && !Array.isArray(next) ? next : (target[part] = {})) as Record<string, unknown>;
      }
      target[path[path.length - 1]] = values[index] ?? null;
    });
    return row;
  });
  return JSON.stringify(rows, null, 2);
}

export function downloadTableJson(snapshot: TableDataSnapshot, title?: string) {
  downloadBlob(new Blob([tableJson(snapshot)], { type: "application/json;charset=utf-8" }), tableFileName(title, "json"));
}

/** Excel limits sheet names to 31 characters and forbids a few. */
function sheetName(title: string | undefined): string {
  return (title ?? "").replace(/[[\]:*?/\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim() || "Sheet1";
}

function xlsxValue(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return validDate(value) ? value : null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  // Workbook strings are stored as text, never as formulas, so no escaping is needed.
  return dataCellText(value);
}

const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 60;
const WIDTH_SAMPLE_ROWS = 500;

/**
 * One worksheet with a bold, frozen and filterable header row, typed cells
 * (numbers, booleans and dates stay sortable in Excel), widths fitted to the
 * content, and right-to-left layout for an RTL page. The writer is loaded only
 * when someone exports.
 */
export async function tableXlsx(snapshot: TableDataSnapshot, options: TableDocumentOptions = {}): Promise<Blob> {
  const { Xlsx } = await import("xlsx-manager");
  // xlsx-manager edits loaded workbooks; a subclass gives it a new, empty sheet.
  class TableWorkbook extends Xlsx {
    constructor() {
      super();
      this.worksheet = this.workbook.addWorksheet(sheetName(options.title), {
        views: [{ state: "frozen", ySplit: 1, rightToLeft: options.dir === "rtl" }],
      });
    }
  }
  const workbook = new TableWorkbook();
  const sheet = workbook.worksheet;
  const header = sheet.addRow(snapshot.headers);
  header.font = { bold: true };
  header.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  });
  for (const values of snapshot.rows) {
    sheet.addRow(values.map(xlsxValue)).eachCell(cell => {
      if (!(cell.value instanceof Date)) return;
      const date = cell.value;
      const midnight = !date.getUTCHours() && !date.getUTCMinutes() && !date.getUTCSeconds();
      cell.numFmt = midnight ? "yyyy-mm-dd" : "yyyy-mm-dd hh:mm";
    });
  }
  snapshot.headers.forEach((label, index) => {
    const sample = snapshot.rows.slice(0, WIDTH_SAMPLE_ROWS).map(values => {
      const value = values[index];
      return validDate(value) ? 16 : Math.max(...dataCellText(value).split("\n").map(line => line.length));
    });
    const width = Math.max(label.length, ...sample) + 2;
    sheet.getColumn(index + 1).width = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width));
  });
  if (snapshot.headers.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: snapshot.headers.length } };
  }
  return new Blob([await workbook.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadTableXlsx(snapshot: TableDataSnapshot, options: TableDocumentOptions = {}) {
  downloadBlob(await tableXlsx(snapshot, options), tableFileName(options.title, "xlsx"));
}

/** Dates in the reader's language; everything else as exported. */
function printCellText(value: unknown, lang: string | undefined): string {
  if (!validDate(value)) return dataCellText(value);
  try { return value.toLocaleDateString(lang); } catch { return value.toLocaleDateString(); }
}

export function printTable(snapshot: TableDataSnapshot, options: TableDocumentOptions = {}) {
  const frame = document.createElement("iframe");
  frame.title = options.title || "Print table";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) { frame.remove(); return; }
  // The copy keeps the page's direction, so an Arabic table starts on the right.
  doc.documentElement.dir = options.dir ?? "ltr";
  if (options.lang) doc.documentElement.lang = options.lang;
  if (options.title) doc.title = options.title;
  const style = doc.createElement("style");
  style.textContent = "body{font:12px sans-serif}h1{font-size:16px;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:start;white-space:pre-wrap}th{background:#f3f4f6}thead{display:table-header-group}tr{break-inside:avoid}";
  doc.head.append(style);
  if (options.title) {
    const heading = doc.createElement("h1");
    heading.textContent = options.title;
    doc.body.append(heading);
  }
  const table = doc.createElement("table");
  const head = table.createTHead().insertRow();
  snapshot.headers.forEach(value => {
    const cell = doc.createElement("th");
    cell.textContent = value;
    head.append(cell);
  });
  const body = table.createTBody();
  snapshot.rows.forEach(values => {
    const row = body.insertRow();
    values.forEach(value => { row.insertCell().textContent = printCellText(value, options.lang); });
  });
  doc.body.append(table);
  const cleanup = () => { clearTimeout(timeout); frame.remove(); };
  const timeout = setTimeout(cleanup, 60_000);
  view.addEventListener("afterprint", cleanup, { once: true });
  try { view.focus(); view.print(); } catch (error) { cleanup(); throw error; }
}

const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);

function safeObject(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const safe = (item: unknown): boolean => {
    if (Array.isArray(item)) return item.every(safe);
    if (!item || typeof item !== "object") return true;
    return Object.entries(item).every(([key, child]) => !unsafeKeys.has(key) && safe(child));
  };
  return safe(value);
}

/** CSV state machine: quoted commas, escaped quotes, CRLF and multiline fields. */
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const endField = () => { row.push(field); field = ""; closed = false; };
  const endRow = () => { const present = closed || row.length > 0 || field !== ""; endField(); if (present) records.push(row); row = []; };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ",") endField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRow();
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Invalid CSV quoting.");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (field || row.length || closed) endRow();
  return records;
}

/** JSON preserves types; CSV values stay strings, with dotted accessor keys nested. */
export function parseTableImport(text: string, filename: string): Record<string, unknown>[] {
  text = text.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("The file is empty.");
  if (/\.json$/i.test(filename)) {
    const rows: unknown = JSON.parse(text);
    if (!Array.isArray(rows) || !rows.length || !rows.every(safeObject)) throw new Error("JSON must contain a non-empty array of row objects with safe field names.");
    return rows as Record<string, unknown>[];
  }
  if (!/\.csv$/i.test(filename)) throw new Error("Choose an XLSX, CSV or JSON file.");
  const [headers, ...records] = csvRecords(text);
  return rowsFromCells(headers, records, "CSV");
}

/** Shared field validation keeps every tabular format safe, including dotted paths. */
function rowsFromCells(headers: string[] | undefined, records: unknown[][], format: string): Record<string, unknown>[] {
  if (!headers?.length || !records.length) throw new Error(format + " must contain headers and at least one row.");
  if (new Set(headers).size !== headers.length || headers.some(key => !key.trim() || key.split(".").some(part => !part || unsafeKeys.has(part)))) throw new Error(format + " headers must be unique, non-empty safe field names.");
  // Reject conflicting paths such as `user` alongside `user.name`.
  if (headers.some(key => headers.some(other => other !== key && other.startsWith(key + ".")))) throw new Error(format + " headers contain conflicting field paths.");
  return records.map(values => {
    if (values.length !== headers.length) throw new Error(format + " row lengths must match the headers.");
    const row: Record<string, unknown> = {};
    headers.forEach((key, index) => {
      const path = key.split(".");
      let target = row;
      for (const part of path.slice(0, -1)) target = (target[part] ??= {}) as Record<string, unknown>;
      target[path[path.length - 1]] = values[index];
    });
    return row;
  });
}

/** XLSX reads the first worksheet; the reader is loaded only for Excel uploads. */
export async function readTableImportFile(file: File): Promise<Record<string, unknown>[]> {
  if (!/\.xlsx$/i.test(file.name)) return parseTableImport(await file.text(), file.name);
  const { readSheet } = await import("read-excel-file/universal");
  let cells;
  try {
    cells = await readSheet(await file.arrayBuffer(), { trim: false });
  } catch {
    throw new Error("Could not read the XLSX workbook. Choose a valid .xlsx file.");
  }
  const [headerCells, ...records] = cells;
  if (!headerCells?.length || headerCells.some(value => typeof value !== "string" || !value.trim())) {
    throw new Error("XLSX must start with a row of non-empty text headers.");
  }
  const headers = headerCells.map(value => (value as string).trim());
  const rows = records
    .filter(values => values.some(value => value != null && value !== ""))
    .map(values => Array.from({ length: Math.max(headers.length, values.length) }, (_, index) => {
      const value = values[index] ?? null;
      return value instanceof Date ? value.toISOString() : value;
    }));
  return rowsFromCells(headers, rows, "XLSX");
}
