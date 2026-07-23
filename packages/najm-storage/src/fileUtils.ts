// ============================================================================
// najm-storage - File Utilities
// ============================================================================

import type { FileAnalysis } from './types';

export enum FileCategory {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  SPREADSHEET = 'SPREADSHEET',
  PRESENTATION = 'PRESENTATION',
  ARCHIVE = 'ARCHIVE',
  CODE = 'CODE',
  TEXT = 'TEXT',
  PDF = 'PDF',
  UNKNOWN = 'UNKNOWN',
}

export const MIME_TYPE_MAP: Record<string, { category: FileCategory; type: string }> = {
  // Images
  'image/jpeg': { category: FileCategory.IMAGE, type: 'jpeg' },
  'image/png': { category: FileCategory.IMAGE, type: 'png' },
  'image/gif': { category: FileCategory.IMAGE, type: 'gif' },
  'image/webp': { category: FileCategory.IMAGE, type: 'webp' },
  'image/svg+xml': { category: FileCategory.IMAGE, type: 'svg' },
  'image/bmp': { category: FileCategory.IMAGE, type: 'bmp' },
  'image/tiff': { category: FileCategory.IMAGE, type: 'tiff' },
  'image/avif': { category: FileCategory.IMAGE, type: 'avif' },
  'image/ico': { category: FileCategory.IMAGE, type: 'ico' },
  'image/x-icon': { category: FileCategory.IMAGE, type: 'ico' },
  // Videos
  'video/mp4': { category: FileCategory.VIDEO, type: 'mp4' },
  'video/webm': { category: FileCategory.VIDEO, type: 'webm' },
  'video/ogg': { category: FileCategory.VIDEO, type: 'ogg' },
  'video/mpeg': { category: FileCategory.VIDEO, type: 'mpeg' },
  'video/quicktime': { category: FileCategory.VIDEO, type: 'mov' },
  'video/x-msvideo': { category: FileCategory.VIDEO, type: 'avi' },
  // Audio
  'audio/mpeg': { category: FileCategory.AUDIO, type: 'mp3' },
  'audio/wav': { category: FileCategory.AUDIO, type: 'wav' },
  'audio/ogg': { category: FileCategory.AUDIO, type: 'ogg' },
  'audio/webm': { category: FileCategory.AUDIO, type: 'webm' },
  'audio/aac': { category: FileCategory.AUDIO, type: 'aac' },
  'audio/flac': { category: FileCategory.AUDIO, type: 'flac' },
  // Documents
  'application/pdf': { category: FileCategory.PDF, type: 'pdf' },
  'application/msword': { category: FileCategory.DOCUMENT, type: 'doc' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { category: FileCategory.DOCUMENT, type: 'docx' },
  'application/vnd.oasis.opendocument.text': { category: FileCategory.DOCUMENT, type: 'odt' },
  // Spreadsheets
  'application/vnd.ms-excel': { category: FileCategory.SPREADSHEET, type: 'xls' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { category: FileCategory.SPREADSHEET, type: 'xlsx' },
  'application/vnd.oasis.opendocument.spreadsheet': { category: FileCategory.SPREADSHEET, type: 'ods' },
  'text/csv': { category: FileCategory.SPREADSHEET, type: 'csv' },
  // Presentations
  'application/vnd.ms-powerpoint': { category: FileCategory.PRESENTATION, type: 'ppt' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { category: FileCategory.PRESENTATION, type: 'pptx' },
  // Archives
  'application/zip': { category: FileCategory.ARCHIVE, type: 'zip' },
  'application/x-rar-compressed': { category: FileCategory.ARCHIVE, type: 'rar' },
  'application/x-tar': { category: FileCategory.ARCHIVE, type: 'tar' },
  'application/gzip': { category: FileCategory.ARCHIVE, type: 'gz' },
  'application/x-7z-compressed': { category: FileCategory.ARCHIVE, type: '7z' },
  // Text & Code
  'text/plain': { category: FileCategory.TEXT, type: 'txt' },
  'text/html': { category: FileCategory.CODE, type: 'html' },
  'text/css': { category: FileCategory.CODE, type: 'css' },
  'text/javascript': { category: FileCategory.CODE, type: 'js' },
  'application/javascript': { category: FileCategory.CODE, type: 'js' },
  'application/json': { category: FileCategory.CODE, type: 'json' },
  'application/xml': { category: FileCategory.CODE, type: 'xml' },
  'text/xml': { category: FileCategory.CODE, type: 'xml' },
  'application/typescript': { category: FileCategory.CODE, type: 'ts' },
  'text/markdown': { category: FileCategory.TEXT, type: 'md' },
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mpeg: 'video/mpeg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  '7z': 'application/x-7z-compressed',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  ts: 'application/typescript',
};

export function getFileCategoryFromMimeType(mimeType: string): FileCategory {
  return MIME_TYPE_MAP[mimeType]?.category ?? FileCategory.UNKNOWN;
}

export function getFileTypeFromMimeType(mimeType: string): string {
  return MIME_TYPE_MAP[mimeType]?.type ?? 'unknown';
}

export function getFileTypeFromExtension(ext: string): string {
  const mime = EXTENSION_MIME_MAP[ext.toLowerCase()];
  return mime ? (MIME_TYPE_MAP[mime]?.type ?? ext) : ext;
}

export function inferMimeTypeFromPath(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MIME_MAP[ext] ?? null;
}

export function resolveStorageMimeType(providedMime: string | undefined | null, filePath: string): string {
  const normalizedMime = providedMime?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalizedMime && normalizedMime !== 'application/octet-stream') {
    return normalizedMime;
  }

  const inferred = inferMimeTypeFromPath(filePath);
  if (inferred) {
    return inferred;
  }

  return normalizedMime || 'application/octet-stream';
}

export function analyzeFile(input: { name: string; type?: string; size: number }): FileAnalysis {
  const normalizedName = input.name.replace(/\\/g, '/').split('/').pop() ?? input.name;
  const extension = normalizedName.includes('.') ? normalizedName.split('.').pop()!.toLowerCase() : '';
  const mimeType = resolveStorageMimeType(input.type, normalizedName);
  const category = getFileCategoryFromMimeType(mimeType);
  const fileTypeFromMime = getFileTypeFromMimeType(mimeType);
  const type = fileTypeFromMime === 'unknown'
    ? (extension ? getFileTypeFromExtension(extension) : 'unknown')
    : fileTypeFromMime;

  return {
    fileName: normalizedName,
    extension,
    mimeType,
    size: input.size,
    category,
    type,
  };
}

export function getReadableFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getFileIcon(category: FileCategory): string {
  const icons: Record<FileCategory, string> = {
    [FileCategory.IMAGE]: 'image',
    [FileCategory.VIDEO]: 'video',
    [FileCategory.AUDIO]: 'audio',
    [FileCategory.DOCUMENT]: 'document',
    [FileCategory.SPREADSHEET]: 'spreadsheet',
    [FileCategory.PRESENTATION]: 'presentation',
    [FileCategory.ARCHIVE]: 'archive',
    [FileCategory.CODE]: 'code',
    [FileCategory.TEXT]: 'text',
    [FileCategory.PDF]: 'pdf',
    [FileCategory.UNKNOWN]: 'unknown',
  };
  return icons[category] ?? 'unknown';
}

export function isImageCategory(category: FileCategory): boolean {
  return category === FileCategory.IMAGE;
}

export function isVideoCategory(category: FileCategory): boolean {
  return category === FileCategory.VIDEO;
}

export function isAudioCategory(category: FileCategory): boolean {
  return category === FileCategory.AUDIO;
}

export function isDocumentCategory(category: FileCategory): boolean {
  return category === FileCategory.DOCUMENT;
}

export function isSpreadsheetCategory(category: FileCategory): boolean {
  return category === FileCategory.SPREADSHEET;
}

export function isPresentationCategory(category: FileCategory): boolean {
  return category === FileCategory.PRESENTATION;
}

export function isArchiveCategory(category: FileCategory): boolean {
  return category === FileCategory.ARCHIVE;
}

export function isCodeCategory(category: FileCategory): boolean {
  return category === FileCategory.CODE;
}

export function isTextCategory(category: FileCategory): boolean {
  return category === FileCategory.TEXT;
}

export function isPdfCategory(category: FileCategory): boolean {
  return category === FileCategory.PDF;
}

export function isUnknownCategory(category: FileCategory): boolean {
  return category === FileCategory.UNKNOWN;
}

export function getAllowedMimeTypes(categories: FileCategory[]): string[] {
  return Object.entries(MIME_TYPE_MAP)
    .filter(([, v]) => categories.includes(v.category))
    .map(([k]) => k);
}

export function validateFileCategory(mimeType: string, allowedCategories: FileCategory[]): boolean {
  const category = getFileCategoryFromMimeType(mimeType);
  return allowedCategories.includes(category);
}

// ============================================================================
// DX Utilities — path/file detection helpers
// ============================================================================

/**
 * Returns true if the value is a string that looks like an already-stored path.
 * Matches: absolute paths (/...), URLs (http...), and storage-relative paths (storage/...).
 */
export function isStoragePath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  return (
    value.startsWith('/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('storage/')
  );
}

/**
 * Returns true if the value is a File or Blob object (browser or server-side).
 */
export function isFileObject(value: unknown): value is File | Blob {
  if (value === null || value === undefined) return false;
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return false;
}

/**
 * Extracts the file extension from a File/Blob name or falls back to a default.
 */
export function getFileExtension(file: File | Blob, fallback = 'bin'): string {
  if (file instanceof File && file.name) {
    return file.name.split('.').pop()?.toLowerCase() ?? fallback;
  }
  const inferred = inferMimeTypeFromPath('.' + fallback);
  return inferred ? fallback : fallback;
}
