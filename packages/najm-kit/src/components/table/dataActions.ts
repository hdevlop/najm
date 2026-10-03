import type { Table } from "@tanstack/react-table";

export interface TableDataSnapshot {
  headers: string[];
  rows: unknown[][];
}

/** Accessor columns only, honoring column eligibility, visibility, filters and sorting. */
export function tableDataSnapshot(table: Table<any>): TableDataSnapshot {
  const columns = table.getVisibleLeafColumns().filter(column => column.accessorFn);
  return {
    headers: columns.map(column => (column.columnDef as { accessorKey?: string }).accessorKey ?? column.id),
    rows: table.getPrePaginationRowModel().rows.map(row => columns.map(column => row.getValue(column.id))),
  };
}

export function dataCellText(value: unknown): string {
  if (value == null) return "";
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

export function downloadTable(snapshot: TableDataSnapshot) {
  const url = URL.createObjectURL(new Blob([tableCsv(snapshot)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "table.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function printTable(snapshot: TableDataSnapshot) {
  const frame = document.createElement("iframe");
  frame.title = "Print table";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  const view = frame.contentWindow;
  if (!doc || !view) { frame.remove(); return; }
  const style = doc.createElement("style");
  style.textContent = "body{font:12px sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:start;white-space:pre-wrap}thead{display:table-header-group}tr{break-inside:avoid}";
  doc.head.append(style);
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
    values.forEach(value => { row.insertCell().textContent = dataCellText(value); });
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
  if (!/\.csv$/i.test(filename)) throw new Error("Choose a CSV or JSON file.");
  const [headers, ...records] = csvRecords(text);
  if (!headers?.length || !records.length) throw new Error("CSV must contain headers and at least one row.");
  if (new Set(headers).size !== headers.length || headers.some(key => !key.trim() || key.split(".").some(part => !part || unsafeKeys.has(part)))) throw new Error("CSV headers must be unique, non-empty safe field names.");
  // Reject conflicting paths such as `user` alongside `user.name`.
  if (headers.some(key => headers.some(other => other !== key && other.startsWith(`${key}.`)))) throw new Error("CSV headers contain conflicting field paths.");
  return records.map(values => {
    if (values.length !== headers.length) throw new Error("CSV row lengths must match the headers.");
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
