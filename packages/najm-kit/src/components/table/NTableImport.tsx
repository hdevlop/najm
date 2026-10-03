import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../Dialog";
import { Button } from "../Button";
import type { NTableToolbarLabels } from "./toolbarContract";
import { dataCellText, parseTableImport } from "./dataActions";

export function NTableImport({ open, onClose, onApply, labels }: {
  open: boolean;
  onClose: () => void;
  onApply: (rows: Record<string, unknown>[]) => Promise<void>;
  labels: NTableToolbarLabels;
}) {
  const [rows, setRows] = React.useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const applyPending = React.useRef(false);
  const request = React.useRef(0);
  React.useEffect(() => {
    request.current++;
    setRows(null);
    setError(null);
    setReading(false);
    return () => { request.current++; };
  }, [open]);

  const readFile = async (file?: File) => {
    const current = ++request.current;
    setRows(null);
    setError(null);
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      const parsed = parseTableImport(await file.text(), file.name);
      if (request.current === current) setRows(parsed);
    } catch (cause) {
      if (request.current === current) setError(cause instanceof Error ? cause.message : (labels.importFailed ?? "Import failed."));
    } finally {
      if (request.current === current) setReading(false);
    }
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

  const fields = rows ? Object.keys(rows[0]).slice(0, 8) : [];
  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !applying) onClose(); }}>
      <DialogContent className="max-w-xl" onEscapeKeyDown={event => { if (applying) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{labels.import ?? "Import"}</DialogTitle>
          <DialogDescription>{labels.importDescription ?? "Choose a CSV or JSON file. Confirm to replace the rows displayed in this table. Imported data stays local unless your app saves it."}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm">
          {labels.importFile ?? "CSV or JSON file"}
          <input type="file" accept=".csv,.json,text/csv,application/json" disabled={applying} onChange={event => { void readFile(event.target.files?.[0]); }} />
        </label>
        {reading && <p role="status">{labels.importReading ?? "Reading file…"}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {rows && <>
          <p role="status" className="text-sm">{labels.importPreview?.(rows.length) ?? `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} ready to import. Preview of the first 5 rows:`}</p>
          <div className="max-h-60 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr>{fields.map(field => <th key={field} className="border border-border p-2 text-start">{field}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((row, index) => <tr key={index}>{fields.map(field => <td key={field} className="border border-border p-2">{dataCellText(row[field])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>}
        <DialogFooter>
          <Button variant="outline" disabled={applying} onClick={onClose}>{labels.importCancel ?? "Cancel"}</Button>
          <Button disabled={!rows || reading || applying} onClick={() => { void apply(); }}>{labels.importConfirm ?? "Replace table data"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
