// ============================================================================
// najm-storage - Storage Validator
// ============================================================================

import { HttpError } from 'najm-core';
import { Service } from 'najm-core';
import { Inject } from 'najm-core';
import { STORAGE_CONFIG } from './tokens';
import type { StorageConfig, ValidateUploadOptions } from './types';
import { getFileCategoryFromMimeType, validateFileCategory, inferMimeTypeFromPath, resolveStorageMimeType } from './fileUtils';

const DEFAULT_BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'scr', 'pif', 'com', 'vbs', 'jar', 'msi', 'sh', 'ps1'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

interface InternalValidateUploadOptions extends ValidateUploadOptions {
  blockedExtensions?: string[];
}

export type ValidateUploadResult =
  | { valid: true; normalized: { path: string; mimeType: string } }
  | { valid: false; error: string };

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unknown validation error';
}

function validateMimeSecurity(mimeType: string, filePath: string, blockedExtensions: string[]): void {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

  if (ext && blockedExtensions.includes(ext)) {
    HttpError.create(400, `File type not allowed: .${ext}`);
  }

  const inferredMime = inferMimeTypeFromPath(filePath);
  if (inferredMime && mimeType !== 'application/octet-stream') {
    const inferredCategory = getFileCategoryFromMimeType(inferredMime);
    const actualCategory = getFileCategoryFromMimeType(mimeType);
    // Only reject when both sides have a known category and they conflict.
    // If the browser-sent MIME isn't in our map (e.g. Windows sends application/x-zip-compressed for .zip),
    // trust the extension rather than throwing — browser MIME varies by OS and is not authoritative.
    if (actualCategory && inferredCategory && inferredCategory !== actualCategory) {
      HttpError.create(400, `MIME type mismatch: declared ${mimeType} but extension suggests ${inferredMime}`);
    }
  }
}

function runUploadValidation(
  input: { filePath: string; mimeType?: string; size: number },
  options: InternalValidateUploadOptions,
): ValidateUploadResult {
  let normalizedPath: string;
  try {
    normalizedPath = normalizeStoragePath(input.filePath);
  } catch (error) {
    return { valid: false, error: asErrorMessage(error) };
  }

  const mimeType = resolveStorageMimeType(input.mimeType, normalizedPath);
  const maxSize = options.maxSize ?? DEFAULT_MAX_FILE_SIZE;

  if (input.size > maxSize) {
    return { valid: false, error: `File too large: max ${maxSize} bytes allowed` };
  }

  if (!options.skipSecurity) {
    try {
      validateMimeSecurity(mimeType, normalizedPath, options.blockedExtensions ?? DEFAULT_BLOCKED_EXTENSIONS);
    } catch (error) {
      return { valid: false, error: asErrorMessage(error) };
    }
  }

  const allowedCategories = options.allowedCategories;
  if (allowedCategories && allowedCategories.length > 0 && !validateFileCategory(mimeType, allowedCategories)) {
    const category = getFileCategoryFromMimeType(mimeType);
    return { valid: false, error: `File category not allowed: ${category}` };
  }

  return {
    valid: true,
    normalized: {
      path: normalizedPath,
      mimeType,
    },
  };
}

export function normalizeStoragePath(rawPath: string): string {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    HttpError.create(400, 'Invalid file path: malformed encoding');
  }

  const normalizedPath = decodedPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  if (normalizedPath.includes('\0')) {
    HttpError.create(400, 'Invalid file path: null bytes not allowed');
  }

  if (normalizedPath.includes('..')) {
    HttpError.create(400, 'Invalid file path: path traversal not allowed');
  }

  if (!normalizedPath.trim()) {
    HttpError.create(400, 'Invalid file path: path cannot be empty');
  }

  return normalizedPath;
}

export function assertSafeStoragePath(path: string): void {
  normalizeStoragePath(path);
}

export function isSafeStoragePath(path: string): boolean {
  try {
    assertSafeStoragePath(path);
    return true;
  } catch {
    return false;
  }
}

export function validateUploadInput(
  input: { filePath: string; mimeType?: string; size: number },
  options: ValidateUploadOptions = {},
): ValidateUploadResult {
  return runUploadValidation(input, {
    ...options,
    maxSize: options.maxSize ?? DEFAULT_MAX_FILE_SIZE,
  });
}

@Service()
export class StorageValidator {
  @Inject(STORAGE_CONFIG) private config: StorageConfig;

  resolveTarget(namespace: string, rawPath: string): { namespace: string; filePath: string } {
    return {
      namespace: this.validateNamespace(namespace),
      filePath: this.normalizePath(rawPath),
    };
  }

  resolveUploadTarget(
    namespace: string,
    rawPath: string,
    providedMime: string | undefined | null,
  ): { namespace: string; filePath: string; mimeType: string } {
    const target = this.resolveTarget(namespace, rawPath);

    return {
      ...target,
      mimeType: this.resolveMimeType(providedMime, target.filePath),
    };
  }

  validateNamespace(namespace: string): string {
    if (!namespace || namespace.includes('..') || namespace.includes('/') || namespace.includes('\\') || namespace.includes('\0')) {
      HttpError.create(400, 'Invalid namespace: must be a simple name without path separators');
    }
    return namespace;
  }

  normalizePath(rawPath: string): string {
    return normalizeStoragePath(rawPath);
  }

  validateSize(sizeBytes: number): void {
    const maxSize = this.config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    if (sizeBytes > maxSize) {
      HttpError.create(413, `File too large: max ${maxSize} bytes allowed`);
    }
  }

  validateSecurity(mimeType: string, filePath: string): void {
    const blocked = this.config.blockedExtensions ?? DEFAULT_BLOCKED_EXTENSIONS;
    validateMimeSecurity(mimeType, filePath, blocked);
  }

  validateCategory(mimeType: string): void {
    const allowed = this.config.allowedCategories;
    if (!allowed || allowed.length === 0) return;

    if (!validateFileCategory(mimeType, allowed)) {
      const category = getFileCategoryFromMimeType(mimeType);
      HttpError.create(400, `File category not allowed: ${category}`);
    }
  }

  resolveMimeType(providedMime: string | undefined | null, filePath: string): string {
    return resolveStorageMimeType(providedMime, filePath);
  }

  decodeBase64(base64: string): Buffer {
    const normalized = base64.trim();
    if (!normalized) {
      return Buffer.alloc(0);
    }

    if (normalized.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(normalized)) {
      HttpError.create(400, 'Invalid base64 data');
    }

    const decoded = Buffer.from(normalized, 'base64');
    const encoded = decoded.toString('base64').replace(/=+$/, '');
    const comparableInput = normalized.replace(/=+$/, '');

    if (encoded !== comparableInput) {
      HttpError.create(400, 'Invalid base64 data');
    }

    return decoded;
  }

  ensureFileExists<T>(value: T | null | undefined, filePath: string, message?: string): T {
    if (value === null || value === undefined) {
      HttpError.notFound(message ?? `File not found: ${filePath}`);
    }

    return value as T;
  }

  ensureDeleteSucceeded(deleted: boolean, filePath: string, message?: string): void {
    if (!deleted) {
      HttpError.notFound(message ?? `File not found: ${filePath}`);
    }
  }

  validateUploadInput(
    input: { filePath: string; mimeType?: string; size: number },
    options: ValidateUploadOptions = {},
  ): ValidateUploadResult {
    return runUploadValidation(input, {
      ...options,
      maxSize: options.maxSize ?? this.config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      allowedCategories: options.allowedCategories ?? this.config.allowedCategories,
      blockedExtensions: this.config.blockedExtensions ?? DEFAULT_BLOCKED_EXTENSIONS,
      skipSecurity: options.skipSecurity ?? false,
    });
  }
}
