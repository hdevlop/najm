import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, NUploader, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from 'najm-kit';

const ACCEPT = '.pdf,.txt,.md,.markdown';
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'];

function isSupported(file: File) {
  return ALLOWED_TYPES.includes(file.type) || /\.(md|markdown|txt|pdf)$/i.test(file.name);
}

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
}

export function UploadSheet({ open, onClose, onUpload }: UploadSheetProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFilesSelected = useCallback((files: File[]) => {
    const selected = files.find(isSupported);
    if (selected) setFile(selected);
  }, []);

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
          <NUploader
            title="Drag and drop a file here"
            subtitle="Supports PDF, TXT, and MD files"
            accept={ACCEPT}
            multiple={false}
            disabled={uploading}
            listTitle="Selected file"
            items={file ? [{
              id: 'selected',
              name: file.name,
              size: file.size,
              mimeType: file.type,
              status: uploading ? 'uploading' : undefined,
            }] : []}
            onFilesSelected={handleFilesSelected}
            onRemove={() => setFile(null)}
          />
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