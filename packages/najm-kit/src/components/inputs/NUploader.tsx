import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../Button";
import { Progress } from "../Progress";
import { NFileTypeIcon } from "../data-display/NFileTypeIcon";
import { cn } from "../../lib/cn";
import { borderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import type { NajmBorderDegree } from "../../theme/types";

export type NUploaderItemStatus = "uploading" | "done" | "error";

export interface NUploaderItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  progress?: number;
  status?: NUploaderItemStatus;
  error?: string;
}

export interface NUploaderProps {
  title?: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  items?: NUploaderItem[];
  emptyListLabel?: string;
  listTitle?: string;
  className?: string;
  dropzoneClassName?: string;
  borderDegree?: NajmBorderDegree;
  onFilesSelected?: (files: File[]) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function NUploader({
  title = "Upload Files",
  subtitle,
  accept,
  multiple = true,
  disabled = false,
  items = [],
  listTitle = "Uploaded files",
  className,
  dropzoneClassName,
  borderDegree,
  onFilesSelected,
  onCancel,
  onRemove,
}: NUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const resolvedBorderDegree = useResolvedBorderDegree({
    borderDegree,
    fallback: "default",
  });
  const dropzoneBorderClass = borderColorClassForDegree(resolvedBorderDegree);

  const emit = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || disabled) return;
      const arr = Array.from(files);
      if (arr.length) onFilesSelected?.(arr);
    },
    [disabled, onFilesSelected],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    emit(e.dataTransfer.files);
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {(title || subtitle) && (
        <div className="text-center">
          {title && (
            <h3 className="text-base font-semibold uppercase tracking-wide text-foreground">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dropzoneBorderClass,
          "bg-muted/40 hover:bg-muted/60",
          isDragging && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-60",
          !disabled && "cursor-pointer",
          dropzoneClassName,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            emit(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="text-sm text-muted-foreground">
          Drag &amp; Drop your files here
        </p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
          or
        </p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Browse Files
        </Button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {listTitle && (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {listTitle}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <UploaderRow
                key={item.id}
                item={item}
                onCancel={onCancel}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  item: NUploaderItem;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
}

function UploaderRow({ item, onCancel, onRemove }: RowProps) {
  const status = item.status ?? "uploading";
  const progress = Math.max(0, Math.min(100, item.progress ?? 0));
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-sm",
        isError ? "border-destructive/30" : "border-border",
      )}
    >
      <NFileTypeIcon
        mimeType={item.mimeType}
        fileName={item.name}
        size="md"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-foreground">
            {item.name}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              isError ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {isDone
              ? formatBytes(item.size)
              : isError
                ? "Failed"
                : `${Math.round(progress)}%`}
          </span>
        </div>
        {!isDone && !isError && <Progress value={progress} className="h-1.5" />}
        {isError && item.error && (
          <span className="text-xs text-destructive">{item.error}</span>
        )}
      </div>

      <div className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : isError ? (
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onRemove?.(item.id)}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <AlertCircle className="h-5 w-5 text-destructive" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Cancel upload"
            onClick={() => onCancel?.(item.id)}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}
