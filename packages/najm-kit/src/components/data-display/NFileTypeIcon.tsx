import React, { useEffect, useState } from "react";
import { Folder } from "lucide-react";
import { FileIcon, defaultStyles } from "react-file-icon";
import { cn } from "../../lib/cn";

type IconSize = "sm" | "md" | "lg" | "xl";

const DIMENSIONS: Record<IconSize, string> = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-16 w-16",
  xl: "h-20 w-20",
};

const MIME_TO_EXT: Array<[RegExp, string]> = [
  [/json/, "json"],
  [/xml/, "xml"],
  [/ya?ml/, "yaml"],
  [/markdown/, "md"],
  [/pdf/, "pdf"],
  [/rar/, "rar"],
  [/tar|gzip|7z/, "tar"],
  [/zip|archive|compressed/, "zip"],
  [/spreadsheet|excel|xls/, "xlsx"],
  [/presentation|powerpoint|ppt/, "pptx"],
  [/word|document|msword|officedocument\.wordprocessingml/, "docx"],
  [/csv/, "csv"],
  [/typescript/, "ts"],
  [/javascript/, "js"],
  [/css/, "css"],
  [/html/, "html"],
  [/php/, "php"],
  [/svg/, "svg"],
  [/webp/, "webp"],
  [/gif/, "gif"],
  [/png/, "png"],
  [/jpeg|jpg/, "jpg"],
  [/photoshop|psd/, "psd"],
  [/illustrator/, "ai"],
  [/postscript|eps/, "eps"],
  [/mpeg|mp3/, "mp3"],
  [/ogg|opus/, "ogg"],
  [/wav|wave/, "wav"],
  [/mp4/, "mp4"],
  [/webm/, "webm"],
  [/quicktime|mov/, "mov"],
  [/avi/, "avi"],
  [/video\//, "mov"],
  [/font|woff|ttf|otf/, "ttf"],
  [/sql/, "sql"],
  [/sqlite|database/, "sqlite"],
  [/text\//, "txt"],
];

type FileType =
  | "image" | "audio" | "video" | "document" | "code" | "compressed"
  | "binary" | "spreadsheet" | "presentation" | "vector" | "font" | "settings" | "acrobat" | "3d";

type Palette = { type?: FileType; color: string; glyphColor?: string; labelColor?: string };

const PALETTE: Record<string, Palette> = {
  // images — bright pink/orange
  png:  { type: "image", color: "#fb923c", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  jpg:  { type: "image", color: "#f43f5e", labelColor: "#e11d48", glyphColor: "#fecdd3" },
  jpeg: { type: "image", color: "#f43f5e", labelColor: "#e11d48", glyphColor: "#fecdd3" },
  gif:  { type: "image", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  webp: { type: "image", color: "#14b8a6", labelColor: "#0d9488", glyphColor: "#99f6e4" },
  svg:  { type: "vector", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  bmp:  { type: "image", color: "#06b6d4", labelColor: "#0891b2", glyphColor: "#a5f3fc" },
  ico:  { type: "image", color: "#0ea5e9", labelColor: "#0284c7", glyphColor: "#bae6fd" },
  raw:  { type: "image", color: "#e11d48", labelColor: "#be123c", glyphColor: "#fecdd3" },
  psd:  { type: "image", color: "#0ea5e9", labelColor: "#0369a1", glyphColor: "#bae6fd" },
  ai:   { type: "vector", color: "#f59e0b", labelColor: "#d97706", glyphColor: "#fde68a" },
  eps:  { type: "vector", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  fig:  { type: "vector", color: "#ec4899", labelColor: "#db2777", glyphColor: "#fbcfe8" },

  // audio — pink/magenta
  mp3:  { type: "audio", color: "#ec4899", labelColor: "#db2777", glyphColor: "#fbcfe8" },
  wav:  { type: "audio", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  ogg:  { type: "audio", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  opus: { type: "audio", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  flac: { type: "audio", color: "#d946ef", labelColor: "#c026d3", glyphColor: "#f5d0fe" },

  // video — fuchsia/indigo
  mp4:  { type: "video", color: "#d946ef", labelColor: "#c026d3", glyphColor: "#f5d0fe" },
  webm: { type: "video", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  mov:  { type: "video", color: "#6366f1", labelColor: "#4f46e5", glyphColor: "#c7d2fe" },
  avi:  { type: "video", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  mkv:  { type: "video", color: "#7c3aed", labelColor: "#6d28d9", glyphColor: "#ddd6fe" },

  // docs — blue/red
  pdf:  { type: "acrobat", color: "#ef4444", labelColor: "#dc2626", glyphColor: "#fecaca" },
  doc:  { type: "document", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  docx: { type: "document", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  txt:  { type: "document", color: "#64748b", labelColor: "#475569", glyphColor: "#cbd5e1" },
  md:   { type: "document", color: "#475569", labelColor: "#334155", glyphColor: "#cbd5e1" },
  rtf:  { type: "document", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },

  // spreadsheets — green
  xls:  { type: "spreadsheet", color: "#16a34a", labelColor: "#15803d", glyphColor: "#bbf7d0" },
  xlsx: { type: "spreadsheet", color: "#16a34a", labelColor: "#15803d", glyphColor: "#bbf7d0" },
  csv:  { type: "spreadsheet", color: "#22c55e", labelColor: "#16a34a", glyphColor: "#bbf7d0" },

  // presentations — orange
  ppt:  { type: "presentation", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  pptx: { type: "presentation", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },

  // code — vibrant
  js:   { type: "code", color: "#facc15", labelColor: "#eab308", glyphColor: "#fef9c3" },
  mjs:  { type: "code", color: "#facc15", labelColor: "#eab308", glyphColor: "#fef9c3" },
  cjs:  { type: "code", color: "#facc15", labelColor: "#eab308", glyphColor: "#fef9c3" },
  ts:   { type: "code", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  jsx:  { type: "code", color: "#06b6d4", labelColor: "#0891b2", glyphColor: "#a5f3fc" },
  tsx:  { type: "code", color: "#0ea5e9", labelColor: "#0284c7", glyphColor: "#bae6fd" },
  html: { type: "code", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  css:  { type: "code", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  scss: { type: "code", color: "#ec4899", labelColor: "#db2777", glyphColor: "#fbcfe8" },
  php:  { type: "code", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  py:   { type: "code", color: "#facc15", labelColor: "#ca8a04", glyphColor: "#fef9c3" },
  java: { type: "code", color: "#ef4444", labelColor: "#dc2626", glyphColor: "#fecaca" },
  go:   { type: "code", color: "#06b6d4", labelColor: "#0891b2", glyphColor: "#a5f3fc" },
  rb:   { type: "code", color: "#ef4444", labelColor: "#dc2626", glyphColor: "#fecaca" },
  rs:   { type: "code", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  c:    { type: "code", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  cpp:  { type: "code", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  cs:   { type: "code", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  swift:{ type: "code", color: "#f97316", labelColor: "#ea580c", glyphColor: "#fed7aa" },
  kt:   { type: "code", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },

  // data — cyan/violet
  json: { type: "code", color: "#06b6d4", labelColor: "#0891b2", glyphColor: "#a5f3fc" },
  xml:  { type: "code", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  yaml: { type: "code", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  yml:  { type: "code", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  toml: { type: "code", color: "#64748b", labelColor: "#475569", glyphColor: "#cbd5e1" },

  // archives — violet
  zip:  { type: "compressed", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },
  rar:  { type: "compressed", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  tar:  { type: "compressed", color: "#f59e0b", labelColor: "#d97706", glyphColor: "#fde68a" },
  gz:   { type: "compressed", color: "#f59e0b", labelColor: "#d97706", glyphColor: "#fde68a" },
  "7z": { type: "compressed", color: "#8b5cf6", labelColor: "#7c3aed", glyphColor: "#ddd6fe" },

  // database — emerald
  sql:    { type: "binary", color: "#3b82f6", labelColor: "#2563eb", glyphColor: "#bfdbfe" },
  db:     { type: "binary", color: "#10b981", labelColor: "#059669", glyphColor: "#a7f3d0" },
  sqlite: { type: "binary", color: "#10b981", labelColor: "#059669", glyphColor: "#a7f3d0" },

  // misc
  log:  { type: "document", color: "#64748b", labelColor: "#475569", glyphColor: "#cbd5e1" },
  env:  { type: "settings", color: "#16a34a", labelColor: "#15803d", glyphColor: "#bbf7d0" },
  cfg:  { type: "settings", color: "#6b7280", labelColor: "#4b5563", glyphColor: "#d1d5db" },
  ini:  { type: "settings", color: "#6b7280", labelColor: "#4b5563", glyphColor: "#d1d5db" },
  conf: { type: "settings", color: "#6b7280", labelColor: "#4b5563", glyphColor: "#d1d5db" },
  exe:  { type: "binary", color: "#facc15", labelColor: "#ca8a04", glyphColor: "#fef9c3" },
  dll:  { type: "binary", color: "#ef4444", labelColor: "#dc2626", glyphColor: "#fecaca" },
  bin:  { type: "binary", color: "#6b7280", labelColor: "#4b5563", glyphColor: "#d1d5db" },
  ttf:  { type: "font", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  otf:  { type: "font", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  woff: { type: "font", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
  woff2:{ type: "font", color: "#a855f7", labelColor: "#9333ea", glyphColor: "#e9d5ff" },
};

const FALLBACK: Palette = { color: "#94a3b8", labelColor: "#64748b", glyphColor: "#cbd5e1" };

function getExtension(fileName?: string): string {
  const clean = fileName?.split(/[?#]/)[0] ?? "";
  const part = clean.split("/").pop() ?? "";
  return part.includes(".") ? part.split(".").pop()!.toLowerCase() : "";
}

function resolveExtension(mimeType = "", fileName?: string): string {
  const ext = getExtension(fileName);
  if (ext) return ext;
  const normalizedMime = mimeType.toLowerCase();
  for (const [pattern, mapped] of MIME_TO_EXT) {
    if (pattern.test(normalizedMime)) return mapped;
  }
  return "txt";
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

export interface NFileTypeIconProps {
  mimeType?: string;
  fileName?: string;
  url?: string;
  showThumbnail?: boolean;
  size?: IconSize;
  className?: string;
  imageClassName?: string;
}

export function NFileTypeIcon({
  mimeType = "",
  fileName,
  url,
  showThumbnail = false,
  size = "md",
  className,
  imageClassName,
}: NFileTypeIconProps) {
  const dim = DIMENSIONS[size];
  const isDark = useIsDark();

  if (showThumbnail && /^image\//.test(mimeType) && url) {
    return (
      <span className={cn(dim, "block shrink-0 overflow-hidden rounded-lg bg-secondary shadow-sm", className)}>
        <img
          src={url}
          alt=""
          loading="lazy"
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </span>
    );
  }

  const extension = resolveExtension(mimeType, fileName);
  const fallback = (defaultStyles as Record<string, any>)[extension] ?? {};
  const palette = PALETTE[extension] ?? FALLBACK;

  const pageColor = isDark ? "#1e293b" : "#ffffff";
  const foldColor = isDark ? "#0f172a" : "#e2e8f0";
  const labelTextColor = "#ffffff";
  const gradientColor = isDark ? "#334155" : "#f8fafc";

  return (
    <span className={cn(dim, "inline-flex shrink-0 items-center justify-center", className)} aria-hidden="true">
      <FileIcon
        extension={extension}
        type={palette.type ?? fallback.type}
        color={pageColor}
        labelColor={palette.labelColor ?? palette.color}
        glyphColor={palette.glyphColor ?? palette.color}
        foldColor={foldColor}
        labelTextColor={labelTextColor}
        gradientColor={gradientColor}
        gradientOpacity={isDark ? 0.6 : 0.25}
      />
    </span>
  );
}

export interface NFolderIconProps {
  size?: IconSize;
  className?: string;
}

export function NFolderIcon({ size = "md", className }: NFolderIconProps) {
  const dim = DIMENSIONS[size];
  const iconSize = size === "xl" ? 72 : size === "lg" ? 56 : size === "md" ? 28 : 18;

  return (
    <span className={cn(dim, "inline-flex shrink-0 items-center justify-center", className)}>
      <Folder size={iconSize} className="text-sky-500" fill="currentColor" strokeWidth={1.5} />
    </span>
  );
}
