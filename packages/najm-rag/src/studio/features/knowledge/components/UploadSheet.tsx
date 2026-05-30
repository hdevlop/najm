import React, { useCallback, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from 'najm-ui';
import { Button } from 'najm-ui';

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export function UploadSheet({ open, onClose, onUpload }: UploadSheetProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'];
      if (allowed.includes(dropped.type) || dropped.name.endsWith('.md')) {
        setFile(dropped);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch {
      // error handled by parent
    } finally {
      setUploading(false);
      setFile(null);
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Document</SheetTitle>
          <SheetDescription>Add a knowledge source to the index.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragOver ? 'border-brand bg-brand/5' : 'border-border hover:border-txt-muted/30'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-brand/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-brand" />
                </div>
                <div className="text-left">
                  <span className="text-sm text-txt-primary font-medium block truncate max-w-[180px]">{file.name}</span>
                  <span className="text-sm text-txt-muted">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button onClick={() => setFile(null)} className="h-7 w-7 rounded-lg flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-card-hover transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-txt-muted" />
                </div>
                <p className="text-sm text-txt-secondary font-medium mb-1">Drag and drop a file here</p>
                <p className="text-sm text-txt-muted mb-4">Supports PDF, TXT, and MD files</p>
                <label className="cursor-pointer inline-flex">
                  <input type="file" accept=".pdf,.txt,.md,.markdown" onChange={handleFileChange} className="hidden" />
                  <Button variant="outline" size="sm" type="button">Browse Files</Button>
                </label>
              </>
            )}
          </div>
          {uploading && (
            <div className="flex items-center justify-center gap-2 text-sm text-txt-muted">
              <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
              Uploading...
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || uploading} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}