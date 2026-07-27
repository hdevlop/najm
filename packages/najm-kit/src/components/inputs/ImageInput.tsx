import React, { useRef, useState, useEffect } from "react";
import { cn } from "../../lib/cn";
import { X, Upload, Image as ImageIcon, Plus } from "lucide-react";
import type { ImageInputProps } from "./types";

const IMAGE_SIZE_MAP = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-40 h-40",
};

export function ImageInput({
  value,
  onChange,
  previewClassName,
  previewStyle,
  contentClassName,
  showPreview = true,
  previewPosition = "top",
  allowClear = true,
  accept = "image/*",
  defaultImage,
  imageSize = "md",
  imageVersion,
  disabled = false,
  uploadIcon,
  title = "Click to upload",
  subtitle,
  titleClassName,
  subtitleClassName,
  replaceTitle = "Replace image",
  replaceSubtitle,
  trigger = "icon",
  buttonLabel = "Upload",
}: ImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (value instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(value);
    } else if (typeof value === "string" && value) {
      const url = imageVersion != null ? `${value}?v=${imageVersion}` : value;
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, [value, imageVersion]);

  const handleClick = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) onChange(file);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const effectiveSize = previewClassName || IMAGE_SIZE_MAP[imageSize];
  const isDropzone = !!previewClassName;
  const effectiveReplaceSubtitle = replaceSubtitle ?? subtitle;

  const renderPreview = () => (
    <div
      style={previewStyle}
      className={cn(
        "flex relative group rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/60 hover:border-primary transition-colors",
        effectiveSize
      )}
    >
      {preview ? (
        isDropzone ? (
          <>
            <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            <div className={cn("relative w-full h-full flex flex-col items-center justify-center gap-1.5 bg-black/40 text-white px-6 py-8 text-center", contentClassName)}>
              <span className={cn("text-sm font-medium", titleClassName)}>{replaceTitle}</span>
              {effectiveReplaceSubtitle ? (
                <span className={cn("text-xs opacity-80", subtitleClassName)}>{effectiveReplaceSubtitle}</span>
              ) : null}
              {allowClear && (
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={disabled}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <div
              onClick={handleClick}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <Upload className="h-8 w-8 text-white" />
            </div>
            {allowClear && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive/90 z-10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        )
      ) : defaultImage ? (
        <>
          <img src={defaultImage} alt="Default" className="w-full h-full object-cover" />
          <div
            onClick={handleClick}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          >
            <Upload className="h-8 w-8 text-white" />
          </div>
        </>
      ) : isDropzone ? (
        <div
          onClick={handleClick}
          className={cn("w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors px-6 py-8 text-center", contentClassName)}
        >
          {(trigger === "icon" || trigger === "both") && (
            <div className="text-primary">
              {uploadIcon ?? <Plus className="h-8 w-8" />}
            </div>
          )}
          {(trigger === "button" || trigger === "both") && (
            <span
              role="button"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              {buttonLabel}
            </span>
          )}
          <span className={cn("text-sm font-medium text-foreground", titleClassName)}>{title}</span>
          {subtitle ? (
            <span className={cn("text-xs text-muted-foreground", subtitleClassName)}>{subtitle}</span>
          ) : null}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <span className="text-xs text-muted-foreground text-center px-2">Click to upload</span>
        </div>
      )}
    </div>
  );

  const renderFileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      onChange={handleChange}
      className="hidden"
      accept={accept}
      disabled={disabled}
    />
  );

  if (!showPreview) return renderFileInput();

  if (previewPosition === "left" || previewPosition === "right") {
    return (
      <div className={cn("flex items-center gap-4", previewPosition === "right" && "flex-row-reverse")}>
        {renderPreview()}
        <div className="flex-1">{renderFileInput()}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", previewPosition === "bottom" && "flex-col-reverse")}>
      {renderPreview()}
      {renderFileInput()}
    </div>
  );
}
