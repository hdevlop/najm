import React from "react";
import { AlertCircle, FileJson, FileSpreadsheet, FileText, Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../Dialog";
import { Button } from "../Button";
import { cn } from "../../lib/cn";
import type { NTableToolbarLabels } from "./toolbarContract";
import { dataCellText, readTableImportFile } from "./dataActions";

const ACCEPT = ".xlsx,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json";
const PREVIEW_ROWS = 5;
const PREVIEW_FIELDS = 8;

function fileSize(bytes: unknown): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ name, className }: { name: string; className?: string }) {
  const Icon = /\.json$/i.test(name) ? FileJson : /\.(xlsx|csv)$/i.test(name) ? FileSpreadsheet : FileText;
  return <Icon aria-hidden="true" className={className} />;
}

export function NTableImport({ open, onClose, onApply, labels, columns }: {
  open: boolean;
  onClose: () => void;
  onApply: (rows: Record<string, unknown>[]) => Promise<void>;
  labels: NTableToolbarLabels;
  /** Field names the app expects, shown as chips under the drop zone. */
  columns?: readonly string[];
}) {
  const [rows, setRows] = React.useState<Record<string, unknown>[] | null>(null);
  const [file, setFile] = React.useState<{ name: string; size: string | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const applyPending = React.useRef(false);
  const request = React.useRef(0);
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    request.current++;
    setRows(null);
    setFile(null);
    setError(null);
    setReading(false);
    return () => { request.current++; };
  }, [open]);

  const readFile = async (chosen?: File) => {
    const current = ++request.current;
    setRows(null);
    setError(null);
    setFile(chosen ? { name: chosen.name, size: fileSize(chosen.size) } : null);
    if (!chosen) { setReading(false); return; }
    setReading(true);
    try {
      const parsed = await readTableImportFile(chosen);
      if (request.current === current) setRows(parsed);
    } catch (cause) {
      if (request.current === current) setError(cause instanceof Error ? cause.message : (labels.importFailed ?? "Import failed."));
    } finally {
      if (request.current === current) setReading(false);
    }
  };

  const clearFile = () => {
    request.current++;
    setRows(null);
    setFile(null);
    setError(null);
    setReading(false);
    if (input.current) input.current.value = "";
  };

  const apply = async () => {
    if (!rows || applyPending.current) return;
    applyPending.current = true;
    setApplying(true);
    setError(null);
    try {
      await onApply(rows);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (labels.importFailed ?? "Import failed."));
    } finally { applyPending.current = false; setApplying(false); }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (applying) return;
    void readFile(event.dataTransfer.files?.[0]);
  };

  const formats = labels.importFile ?? "XLSX, CSV or JSON file";
  const fields = rows ? Object.keys(rows[0]).slice(0, PREVIEW_FIELDS) : [];
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !applying) onClose(); }}>
      <DialogContent className="max-w-xl gap-5" onEscapeKeyDown={event => { if (applying) event.preventDefault(); }}>
        <DialogHeader className="flex-row items-start gap-3 text-start">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <div className="grid min-w-0 gap-1.5">
            <DialogTitle>{labels.import ?? "Import"}</DialogTitle>
            <DialogDescription>{labels.importDescription ?? "Choose an XLSX, CSV or JSON file. Excel uses the first worksheet, with headers in its first row. Confirm to replace the rows displayed in this table. Imported data stays local unless your app saves it."}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid min-w-0 gap-3">
          {/* The whole zone is the input's label, so a click anywhere browses. */}
          <label
            data-ntable-import-dropzone
            data-dragging={dragging ? "true" : undefined}
            onDragOver={event => { event.preventDefault(); if (!applying) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors",
              "hover:border-primary/60 hover:bg-primary/5 has-[input:focus-visible]:border-primary has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
              dragging && "border-primary bg-primary/10",
              applying && "pointer-events-none opacity-60",
              file && "flex-row gap-3 py-3",
            )}
          >
            <span aria-hidden="true" className={cn("flex items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5", file ? "h-8 w-8" : "h-11 w-11")}>
              <Upload className={file ? "h-4 w-4" : "h-5 w-5"} />
            </span>
            <span className="text-sm font-medium text-foreground">{labels.importDrop ?? "Drop a file here, or click to browse"}</span>
            {!file && <span className="text-xs text-muted-foreground">{formats}</span>}
            <input ref={input} type="file" aria-label={formats} accept={ACCEPT} disabled={applying} className="sr-only" onChange={event => { void readFile(event.target.files?.[0]); }} />
          </label>

          {file && (
            <div data-ntable-import-file className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileIcon name={file.name} className="h-5 w-5" />
              </span>
              <div className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium" title={file.name}>{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[file.size, rows ? (labels.importRowCount?.(rows.length) ?? `${rows.length} ${rows.length === 1 ? "row" : "rows"}`) : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              {reading && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              <button
                type="button"
                aria-label={labels.importRemove ?? "Remove file"}
                title={labels.importRemove ?? "Remove file"}
                disabled={applying}
                onClick={clearFile}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!file && columns && columns.length > 0 && (
            <div data-ntable-import-columns className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">{labels.importColumns ?? "Expected columns"}</span>
              <div className="flex flex-wrap gap-1.5">
                {columns.map(column => (
                  <code key={column} className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground">{column}</code>
                ))}
              </div>
            </div>
          )}

          {reading && <p role="status" className="sr-only">{labels.importReading ?? "Reading file…"}</p>}
          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          {rows && (
            <div className="grid min-w-0 gap-2">
              <p role="status" className="text-xs font-medium text-muted-foreground">{labels.importPreview?.(rows.length) ?? `${rows.length} ${rows.length === 1 ? "row" : "rows"} ready to import. Preview of the first ${PREVIEW_ROWS} rows:`}</p>
              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>{fields.map(field => <th key={field} className="whitespace-nowrap px-3 py-2 text-start font-medium text-muted-foreground">{field}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        {fields.map(field => <td key={field} className="max-w-48 truncate whitespace-nowrap px-3 py-2">{dataCellText(row[field])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={applying} onClick={onClose}>{labels.importCancel ?? "Cancel"}</Button>
          <Button disabled={!rows || reading || applying} onClick={() => { void apply(); }}>
            {applying && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {labels.importConfirm ?? "Replace table data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
