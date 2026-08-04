import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { X, Upload, Image as ImageIcon, Plus } from "lucide-react";
import type { ImageInputProps } from "./types";
import type { ImageInputPreviewCandidate } from "./imagePreview";
import {
  appendImageVersion,
  buildPreviewCandidates,
  candidatesKey,
} from "./imagePreview";

const IMAGE_SIZE_MAP = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
  xl: "w-40 h-40",
};

/**
 * Hide-on-fine-pointer / show-on-hover-or-focus classes.
 *
 * The visibility rules ship as compiled CSS in `dist/theme.css` (see
 * `.nimage-input-control` and `.nimage-input-compact-overlay`). The dynamic
 * Tailwind arbitrary-class pattern was not emitted into the consumer's
 * compiled CSS, so the hover/focus reveal never actually applied on real
 * layouts. The static classes match the existing `ntable-card-action`
 * pattern and are scanner-traceable.
 */
const CONTROL_VISIBILITY = "nimage-input-control";
const COMPACT_OVERLAY_VISIBILITY = "nimage-input-compact-overlay";

export function ImageInput({
  value,
  onChange,
  containerClassName,
  previewClassName,
  previewStyle,
  contentClassName,
  imageClassName,
  showPreview = true,
  previewPosition = "top",
  allowClear = true,
  accept = "image/*",
  defaultImage,
  fallbackImage,
  previewAlt,
  fallbackAlt,
  unavailableContent,
  onPreviewError,
  replaceAriaLabel,
  clearAriaLabel,
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
  const [localFilePreview, setLocalFilePreview] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());

  const readerTokenRef = useRef(0);

  const previewCandidates = useMemo(() => {
    if (value instanceof File) return [] as ImageInputPreviewCandidate[];
    if (typeof value === "string" && value) {
      return buildPreviewCandidates({
        value,
        fallback: fallbackImage ?? null,
        defaultImage: defaultImage ?? null,
        imageVersion,
      });
    }
    return buildPreviewCandidates({
      value: null,
      fallback: null,
      defaultImage: defaultImage ?? null,
      imageVersion,
    });
  }, [value, fallbackImage, defaultImage, imageVersion]);

  const candidateKeyValue = useMemo(
    () => candidatesKey(previewCandidates),
    [previewCandidates],
  );

  const [trackedKey, setTrackedKey] = useState(candidateKeyValue);
  if (trackedKey !== candidateKeyValue) {
    setTrackedKey(candidateKeyValue);
    setFailedSources(new Set());
  }

  useEffect(() => {
    if (!(value instanceof File)) {
      setLocalFilePreview(null);
      return undefined;
    }
    const token = ++readerTokenRef.current;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (token !== readerTokenRef.current) return;
      if (typeof reader.result === "string") {
        setLocalFilePreview(reader.result);
      }
    };
    reader.onerror = () => {
      if (token !== readerTokenRef.current) return;
      setLocalFilePreview(null);
    };
    reader.readAsDataURL(value);
    return () => {
      if (token === readerTokenRef.current) {
        readerTokenRef.current = token - 1;
      }
    };
  }, [value]);

  const activeCandidate = useMemo<ImageInputPreviewCandidate | null>(() => {
    if (value instanceof File) return null;
    for (const candidate of previewCandidates) {
      if (!failedSources.has(candidate.src)) return candidate;
    }
    return null;
  }, [previewCandidates, failedSources, value]);

  const handleCandidateError = (candidate: ImageInputPreviewCandidate) => {
    setFailedSources((prev) => {
      if (prev.has(candidate.src)) return prev;
      const next = new Set(prev);
      next.add(candidate.src);
      return next;
    });
    onPreviewError?.({ source: candidate.source, src: candidate.src });
  };

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) onChange(file);
    e.target.value = "";
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(null);
    setLocalFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImgError = () => {
    if (value instanceof File) return;
    if (activeCandidate) handleCandidateError(activeCandidate);
  };

  const effectiveSize = previewClassName || IMAGE_SIZE_MAP[imageSize];
  const isDropzone = !!previewClassName;
  const effectiveReplaceSubtitle = replaceSubtitle ?? subtitle;
  const primaryAlt = previewAlt ?? replaceTitle ?? "Preview";
  const secondaryAlt = fallbackAlt ?? previewAlt ?? replaceTitle ?? "Preview";
  const replaceAccessibleName = replaceAriaLabel ?? replaceTitle;
  const clearAccessibleName = clearAriaLabel ?? "Remove image";

  type PreviewState = "empty" | "preview" | "fallback" | "unavailable";
  let dataState: PreviewState = "empty";
  let previewSrc: string | null = null;
  let previewAltText = primaryAlt;

  if (value instanceof File) {
    dataState = localFilePreview ? "preview" : "empty";
    previewSrc = localFilePreview;
    previewAltText = primaryAlt;
  } else if (activeCandidate) {
    dataState = activeCandidate.source === "value" ? "preview" : "fallback";
    previewSrc = activeCandidate.src;
    previewAltText =
      activeCandidate.source === "value" ? primaryAlt : secondaryAlt;
  } else if (previewCandidates.length > 0) {
    dataState = "unavailable";
  }

  const renderUnavailableContent = () =>
    unavailableContent ?? (
      <>
        <ImageIcon className="h-10 w-10 text-muted-foreground/50" aria-hidden />
        <span className="text-xs text-muted-foreground">Image unavailable</span>
      </>
    );

  const renderClearButton = (compact: boolean) => {
    if (!allowClear) return null;
    return (
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled}
        aria-label={clearAccessibleName}
        className={cn(
          "absolute top-2 end-2 z-10 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "p-1.5" : "h-6 w-6",
          CONTROL_VISIBILITY,
        )}
      >
        <X className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
    );
  };

  const renderPreview = () => (
    <div
      style={previewStyle}
      data-image-input-state={dataState}
      className={cn(
        "group/image flex relative rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/60 hover:border-primary transition-colors",
        effectiveSize,
      )}
    >
      {previewSrc ? (
        isDropzone ? (
          <>
            <img
              src={previewSrc}
              alt={previewAltText}
              onError={handleImgError}
              className={cn(
                "absolute inset-0 w-full h-full object-cover",
                imageClassName,
              )}
            />
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              aria-label={replaceAccessibleName}
              className={cn(
                "relative w-full h-full flex flex-col items-center justify-center gap-1.5 bg-black/40 text-white px-6 py-8 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                contentClassName,
              )}
            >
              <span className={cn("text-sm font-medium", titleClassName)}>
                {replaceTitle}
              </span>
              {effectiveReplaceSubtitle ? (
                <span className={cn("text-xs opacity-80", subtitleClassName)}>
                  {effectiveReplaceSubtitle}
                </span>
              ) : null}
            </button>
            {renderClearButton(false)}
          </>
        ) : (
          <>
            <img
              src={previewSrc}
              alt={previewAltText}
              onError={handleImgError}
              className={cn("w-full h-full", imageClassName ?? "object-cover")}
            />
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              aria-label={replaceAccessibleName}
              className={cn(
                "absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                COMPACT_OVERLAY_VISIBILITY,
              )}
            >
              <Upload className="h-8 w-8 text-white" aria-hidden />
            </button>
            {renderClearButton(true)}
          </>
        )
      ) : dataState === "unavailable" ? (
        <div
          data-image-input-unavailable
          className={cn(
            "w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground px-6 py-8 text-center",
            contentClassName,
          )}
        >
          {renderUnavailableContent()}
        </div>
      ) : isDropzone ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={replaceAriaLabel ?? title}
          className={cn(
            "w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors px-6 py-8 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            contentClassName,
          )}
        >
          {(trigger === "icon" || trigger === "both") && (
            <div className="text-primary">
              {uploadIcon ?? <Plus className="h-8 w-8" />}
            </div>
          )}
          {(trigger === "button" || trigger === "both") && (
            <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground">
              {buttonLabel}
            </span>
          )}
          <span className={cn("text-sm font-medium text-foreground", titleClassName)}>
            {title}
          </span>
          {subtitle ? (
            <span className={cn("text-xs text-muted-foreground", subtitleClassName)}>
              {subtitle}
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={replaceAriaLabel ?? title}
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-2" aria-hidden />
          <span className="text-xs text-muted-foreground text-center px-2">
            {title}
          </span>
        </button>
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
      aria-hidden
      tabIndex={-1}
    />
  );

  if (!showPreview) return renderFileInput();

  if (previewPosition === "left" || previewPosition === "right") {
    return (
      <div
        className={cn(
          "flex items-center gap-4",
          previewPosition === "right" && "flex-row-reverse",
          containerClassName,
        )}
      >
        {renderPreview()}
        <div className="flex-1">{renderFileInput()}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        previewPosition === "bottom" && "flex-col-reverse",
        containerClassName,
      )}
    >
      {renderPreview()}
      {renderFileInput()}
    </div>
  );
}