import React from 'react';
import { Plus, Trash2, Loader2, RefreshCcw, Download, Upload, X, Library } from 'lucide-react';
import { Button } from 'najm-kit';

interface SemanticsToolbarProps {
  totalPhrases: number;
  pendingCount: number;
  selectedCount: number;
  transferring: boolean;
  reindexing: boolean;
  deletingSelected: boolean;
  clearing: boolean;
  createMode: string | null;
  hasImportFiles: boolean;
  hasImport: boolean;
  hasExport: boolean;
  hasDeleteBatch: boolean;
  hasClearAll: boolean;
  hasReindexAll: boolean;
  onImportClick: () => void;
  onExportClick: () => void;
  onDeleteSelectedClick: () => void;
  onClearAllClick: () => void;
  onReindexClick: () => void;
  onAddSingle: () => void;
  onAddBulk: () => void;
  onClose: () => void;
  showBulkAdd?: boolean;
}

export function SemanticsToolbar({
  totalPhrases,
  pendingCount,
  selectedCount,
  transferring,
  reindexing,
  deletingSelected,
  clearing,
  createMode,
  hasImportFiles,
  hasImport,
  hasExport,
  hasDeleteBatch,
  hasClearAll,
  hasReindexAll,
  onImportClick,
  onExportClick,
  onDeleteSelectedClick,
  onClearAllClick,
  onReindexClick,
  onAddSingle,
  onAddBulk,
  onClose,
  showBulkAdd = true,
}: SemanticsToolbarProps) {
  return (
    <>
        {hasImportFiles && (
          <Button variant="outline" onClick={onImportClick} disabled={transferring} className="min-w-[120px] justify-center gap-1.5 px-2">
            {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Import</span>
          </Button>
        )}
        {!hasImportFiles && hasImport && (
          <Button variant="outline" onClick={onImportClick} disabled={transferring} className="min-w-[120px] justify-center gap-1.5 px-2">
            {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Import</span>
          </Button>
        )}
        {hasExport && (
          <Button variant="outline" onClick={onExportClick} disabled={transferring} className="min-w-[120px] justify-center gap-1.5 px-2">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}
        {hasDeleteBatch && selectedCount > 0 && (
          <Button variant="outline" onClick={onDeleteSelectedClick} disabled={deletingSelected || transferring} className="min-w-[120px] justify-center gap-1.5 border-status-red/40 px-2 text-status-red hover:bg-status-red/10 hover:text-status-red">
            {deletingSelected ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Delete ({selectedCount})</span>
          </Button>
        )}
        {hasClearAll && totalPhrases > 0 && (
          <Button variant="outline" onClick={onClearAllClick} disabled={transferring || clearing} className="min-w-[120px] justify-center gap-1.5 border-status-red/40 px-2 text-status-red hover:bg-status-red/10 hover:text-status-red">
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Clear All</span>
          </Button>
        )}
        {hasReindexAll && pendingCount > 0 && (
          <Button variant="outline" onClick={onReindexClick} disabled={reindexing} className="min-w-[120px] justify-center gap-1.5 px-2">
            {reindexing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Reindex All</span>
          </Button>
        )}
        {createMode !== null ? (
          <Button variant="outline" onClick={onClose} className="min-w-[120px] justify-center gap-1.5 px-2">
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        ) : (
          <>
            <Button onClick={onAddSingle} className="min-w-[120px] justify-center gap-1.5 border border-border bg-card px-2 text-foreground shadow-sm hover:bg-accent hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Phrase</span>
            </Button>
            {showBulkAdd && (
              <Button variant="outline" onClick={onAddBulk} className="hidden min-w-[120px] justify-center gap-1.5 px-2 sm:inline-flex">
                <Library className="h-3.5 w-3.5" />
                <span>Bulk Add</span>
              </Button>
            )}
          </>
        )}
    </>
  );
}
