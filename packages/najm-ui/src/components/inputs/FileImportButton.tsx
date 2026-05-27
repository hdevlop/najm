import React, { useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";

interface FileImportButtonProps {
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
  loading?: boolean;
}

export function FileImportButton({
  onFile,
  onFiles,
  accept = '.json',
  multiple = false,
  children,
  loading,
}: FileImportButtonProps) {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (multiple && onFiles) {
      onFiles(files);
    } else if (!multiple && onFile && files.length > 0) {
      onFile(files[0]);
    }

    e.target.value = '';
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
        disabled={loading}
        className="gap-1.5"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {children ?? (multiple ? 'Import Files' : 'Import')}
      </Button>
    </>
  );
}