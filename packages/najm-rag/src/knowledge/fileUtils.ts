import type { DocumentSourceType } from './KnowledgeDto';

export function extensionFromPath(path: string): string {
  return path.includes('.') ? path.split('.').pop()!.toLowerCase() : '';
}

export function mimeForSourceType(sourceType: DocumentSourceType): string {
  if (sourceType === 'pdf') return 'application/pdf';
  if (sourceType === 'markdown') return 'text/markdown';
  if (sourceType === 'image') return 'image/*';
  return 'text/plain';
}

export function sourceTypeFromUpload(ext: string, mime: string): DocumentSourceType | null {
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return 'markdown';
  if (ext === 'txt' || mime.startsWith('text/plain')) return 'text';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

export function extensionFromMime(mime: string): string | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/markdown') return 'md';
  if (mime.startsWith('text/plain')) return 'txt';
  if (mime.startsWith('image/')) return mime.slice('image/'.length).replace('jpeg', 'jpg') || 'img';
  return null;
}

export function mimeFromExtension(ext: string): string {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

export interface UploadAnalysis {
  fileName: string | null;
  ext: string;
  mime: string;
  size: number;
  sourceType: DocumentSourceType;
}

export function analyzeUploadFile(file: File | Blob): UploadAnalysis {
  const fileName = typeof File !== 'undefined' && file instanceof File ? file.name : null;
  const ext = (fileName?.split('.').pop() ?? extensionFromMime(file.type) ?? '').toLowerCase();
  const mime = file.type || mimeFromExtension(ext);
  const sourceType = sourceTypeFromUpload(ext, mime);

  if (!sourceType) {
    throw new Error('Unsupported upload type. Expected PDF, text, Markdown, or image.');
  }

  return {
    fileName,
    ext,
    mime,
    size: file.size,
    sourceType,
  };
}
