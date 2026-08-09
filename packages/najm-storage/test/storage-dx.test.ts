import { describe, expect, test } from 'bun:test';
import { MCP_REGISTRY } from 'najm-mcp';
import {
  FileCategory,
  StorageMcpTools,
  StorageService,
  StorageValidator,
  analyzeFile,
  assertSafeStoragePath,
  getFileCategoryFromMimeType,
  getReadableFileSize,
  inferMimeTypeFromPath,
  isSafeStoragePath,
  normalizeStoragePath,
  resolveStorageMimeType,
  storage,
  validateUploadInput,
  storageNamespaceSchema,
  storagePathSchema,
  storageUploadSchema,
  toStorageFileDto,
} from '../src';
import type { FileInfo, IStorageProvider } from '../src';

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

interface TestContext {
  service: StorageService;
  files: Map<string, { data: Buffer; info: FileInfo }>;
  events: Array<{ event: string; data: any }>;
}

function createInMemoryProvider(files: Map<string, { data: Buffer; info: FileInfo }>): IStorageProvider {
  return {
    async get(namespace: string, filePath: string): Promise<Buffer | null> {
      return files.get(`${namespace}/${filePath}`)?.data ?? null;
    },
    async getInfo(namespace: string, filePath: string): Promise<FileInfo | null> {
      return files.get(`${namespace}/${filePath}`)?.info ?? null;
    },
    async save(namespace: string, filePath: string, data: Buffer, mimeType: string): Promise<void> {
      const now = new Date().toISOString();
      const existing = files.get(`${namespace}/${filePath}`)?.info;

      files.set(`${namespace}/${filePath}`, {
        data,
        info: {
          namespace,
          filePath,
          mimeType,
          size: data.length,
          category: getFileCategoryFromMimeType(mimeType),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
      });
    },
    async delete(namespace: string, filePath: string): Promise<boolean> {
      return files.delete(`${namespace}/${filePath}`);
    },
    async list(namespace: string): Promise<FileInfo[]> {
      return Array.from(files.values())
        .map((entry) => entry.info)
        .filter((info) => info.namespace === namespace);
    },
    async deleteAll(namespace: string): Promise<void> {
      for (const key of files.keys()) {
        if (key.startsWith(`${namespace}/`)) files.delete(key);
      }
    },
    async copy(sourceNs: string, targetNs: string): Promise<void> {
      for (const [key, value] of files.entries()) {
        if (!key.startsWith(`${sourceNs}/`)) continue;
        const filePath = value.info.filePath;
        files.set(`${targetNs}/${filePath}`, {
          data: Buffer.from(value.data),
          info: { ...value.info, namespace: targetNs },
        });
      }
    },
  };
}

function createStorageValidatorForTests(overrides?: Partial<{
  maxFileSize: number;
  allowedCategories: FileCategory[];
  blockedExtensions: string[];
}>): StorageValidator {
  const validator = new StorageValidator() as any;
  validator.config = {
    maxFileSize: overrides?.maxFileSize ?? 10 * 1024 * 1024,
    allowedCategories: overrides?.allowedCategories,
    blockedExtensions: overrides?.blockedExtensions,
  };
  return validator as StorageValidator;
}

function createTestContext(validatorOverrides?: Parameters<typeof createStorageValidatorForTests>[0]): TestContext {
  const files = new Map<string, { data: Buffer; info: FileInfo }>();
  const events: Array<{ event: string; data: any }> = [];
  const service = new StorageService() as any;

  service.provider = createInMemoryProvider(files);
  service.validator = createStorageValidatorForTests(validatorOverrides);
  service.events = {
    emit: (event: string, data: any) => events.push({ event, data }),
    on: () => {},
  };

  return { service: service as StorageService, files, events };
}

// ===========================================================================
// Path helpers
// ===========================================================================

describe('storage path helpers', () => {
  test('normalizes slashes, encoding, and leading separators', () => {
    expect(normalizeStoragePath('/icons%2Flogo.png')).toBe('icons/logo.png');
    expect(normalizeStoragePath('\\nested\\path\\icon.svg')).toBe('nested/path/icon.svg');
  });

  test('rejects traversal, null bytes, and malformed encoding', () => {
    expect(() => normalizeStoragePath('../secret.txt')).toThrow('path traversal');
    expect(() => assertSafeStoragePath('icons\0bad.png')).toThrow('null bytes');
    expect(() => normalizeStoragePath('%E0%A4%A')).toThrow('malformed encoding');
  });

  test('rejects empty and whitespace-only paths', () => {
    expect(() => normalizeStoragePath('')).toThrow('path cannot be empty');
    expect(() => normalizeStoragePath('   ')).toThrow('path cannot be empty');
  });

  test('checks path safety without throwing', () => {
    expect(isSafeStoragePath('images/photo.png')).toBe(true);
    expect(isSafeStoragePath('../images/photo.png')).toBe(false);
    expect(isSafeStoragePath('')).toBe(false);
  });
});

// ===========================================================================
// MIME helpers
// ===========================================================================

describe('mime helpers', () => {
  test('prefers provided mime type when specific', () => {
    expect(resolveStorageMimeType('image/webp; charset=utf-8', 'image.png')).toBe('image/webp');
  });

  test('falls back to extension then octet-stream', () => {
    expect(resolveStorageMimeType('application/octet-stream', 'image.png')).toBe('image/png');
    expect(resolveStorageMimeType(undefined, 'file.unknown')).toBe('application/octet-stream');
  });

  test('handles null and empty mime type', () => {
    expect(resolveStorageMimeType(null, 'photo.jpg')).toBe('image/jpeg');
    expect(resolveStorageMimeType('', 'photo.jpg')).toBe('image/jpeg');
  });

  test('covers extension to mime inference matrix', () => {
    const extensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'avif', 'ico',
      'mp4', 'webm', 'ogv', 'mpeg', 'mov', 'avi',
      'mp3', 'wav', 'ogg', 'aac', 'flac',
      'pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx',
      'zip', 'rar', 'tar', 'gz', '7z',
      'txt', 'md', 'html', 'htm', 'css', 'js', 'json', 'xml', 'ts',
    ];

    for (const ext of extensions) {
      expect(inferMimeTypeFromPath(`file.${ext}`)).not.toBeNull();
    }
  });
});

// ===========================================================================
// File analysis and upload validation
// ===========================================================================

describe('file analysis and upload validation', () => {
  test('analyzes file metadata from name, type, and size', () => {
    const analysis = analyzeFile({ name: 'assets/hero.PNG', type: 'application/octet-stream', size: 5120 });
    expect(analysis.fileName).toBe('hero.PNG');
    expect(analysis.extension).toBe('png');
    expect(analysis.mimeType).toBe('image/png');
    expect(analysis.category).toBe(FileCategory.IMAGE);
    expect(analysis.type).toBe('png');
  });

  test('validates upload options and edge cases', () => {
    const valid = validateUploadInput({ filePath: 'icons/logo.svg', size: 128 });
    expect(valid.valid).toBe(true);
    if (valid.valid) {
      expect(valid.normalized.path).toBe('icons/logo.svg');
      expect(valid.normalized.mimeType).toBe('image/svg+xml');
    }

    const tooLarge = validateUploadInput(
      { filePath: 'icons/logo.svg', size: 2048 },
      { maxSize: 1024 },
    );
    expect(tooLarge.valid).toBe(false);

    const blocked = validateUploadInput({ filePath: 'scripts/run.exe', size: 10 });
    expect(blocked.valid).toBe(false);

    const skippedSecurity = validateUploadInput(
      { filePath: 'scripts/run.exe', size: 10 },
      { skipSecurity: true },
    );
    expect(skippedSecurity.valid).toBe(true);

    const invalidCategory = validateUploadInput(
      { filePath: 'manual.pdf', size: 10 },
      { allowedCategories: [FileCategory.IMAGE] },
    );
    expect(invalidCategory.valid).toBe(false);
  });

  test('rejects invalid file paths in upload validation', () => {
    const traversal = validateUploadInput({ filePath: '../etc/passwd', size: 10 });
    expect(traversal.valid).toBe(false);

    const empty = validateUploadInput({ filePath: '', size: 10 });
    expect(empty.valid).toBe(false);
  });
});

// ===========================================================================
// Readable file size
// ===========================================================================

describe('getReadableFileSize', () => {
  test('formats bytes to human-readable strings', () => {
    expect(getReadableFileSize(0)).toBe('0 B');
    expect(getReadableFileSize(512)).toBe('512 B');
    expect(getReadableFileSize(1024)).toBe('1.0 KB');
    expect(getReadableFileSize(1536)).toBe('1.5 KB');
    expect(getReadableFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(getReadableFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(getReadableFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

// ===========================================================================
// Zod schemas and DTO mapper
// ===========================================================================

describe('zod schemas', () => {
  test('storageNamespaceSchema accepts valid namespaces', () => {
    expect(storageNamespaceSchema.safeParse('book-1').success).toBe(true);
    expect(storageNamespaceSchema.safeParse('my_project').success).toBe(true);
  });

  test('storageNamespaceSchema rejects invalid namespaces', () => {
    expect(storageNamespaceSchema.safeParse('').success).toBe(false);
    expect(storageNamespaceSchema.safeParse('a/b').success).toBe(false);
    expect(storageNamespaceSchema.safeParse('a\\b').success).toBe(false);
    expect(storageNamespaceSchema.safeParse('..').success).toBe(false);
  });

  test('storagePathSchema accepts valid paths', () => {
    expect(storagePathSchema.safeParse('icons/star.png').success).toBe(true);
    expect(storagePathSchema.safeParse('file.txt').success).toBe(true);
  });

  test('storagePathSchema rejects invalid paths', () => {
    expect(storagePathSchema.safeParse('').success).toBe(false);
    expect(storagePathSchema.safeParse('/absolute.txt').success).toBe(false);
    expect(storagePathSchema.safeParse('../traversal.txt').success).toBe(false);
    expect(storagePathSchema.safeParse('file\0bad.txt').success).toBe(false);
  });

  test('storageUploadSchema validates upload input', () => {
    expect(storageUploadSchema.safeParse({ filePath: 'icon.png', size: 100 }).success).toBe(true);
    expect(storageUploadSchema.safeParse({ filePath: 'icon.png', mimeType: 'image/png', size: 100 }).success).toBe(true);
    expect(storageUploadSchema.safeParse({ filePath: '', size: 100 }).success).toBe(false);
    expect(storageUploadSchema.safeParse({ filePath: 'icon.png', size: -1 }).success).toBe(false);
  });
});

describe('toStorageFileDto', () => {
  test('maps FileInfo to StorageFileDto with renamed path field', () => {
    const info: FileInfo = {
      namespace: 'book-1',
      filePath: 'icons/star.png',
      mimeType: 'image/png',
      size: 1024,
      category: FileCategory.IMAGE,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    };

    const dto = toStorageFileDto(info);
    expect(dto.namespace).toBe('book-1');
    expect(dto.path).toBe('icons/star.png');
    expect(dto.mimeType).toBe('image/png');
    expect(dto.size).toBe(1024);
    expect(dto.category).toBe(FileCategory.IMAGE);
    expect(dto.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(dto.updatedAt).toBe('2025-01-02T00:00:00.000Z');
  });
});

// ===========================================================================
// Storage validator service
// ===========================================================================

describe('storage validator service', () => {
  test('validateNamespace accepts simple names', () => {
    const v = createStorageValidatorForTests();
    expect(v.validateNamespace('book-1')).toBe('book-1');
    expect(v.validateNamespace('my_project')).toBe('my_project');
  });

  test('validateNamespace rejects path separators, traversal, and empty', () => {
    const v = createStorageValidatorForTests();
    expect(() => v.validateNamespace('')).toThrow('Invalid namespace');
    expect(() => v.validateNamespace('a/b')).toThrow('Invalid namespace');
    expect(() => v.validateNamespace('a\\b')).toThrow('Invalid namespace');
    expect(() => v.validateNamespace('..')).toThrow('Invalid namespace');
    expect(() => v.validateNamespace('a\0b')).toThrow('Invalid namespace');
  });

  test('validateSize enforces configured max file size', () => {
    const v = createStorageValidatorForTests({ maxFileSize: 1024 });
    expect(() => v.validateSize(512)).not.toThrow();
    expect(() => v.validateSize(1024)).not.toThrow();
    expect(() => v.validateSize(1025)).toThrow('File too large');
  });

  test('validateSecurity blocks dangerous extensions', () => {
    const v = createStorageValidatorForTests();
    expect(() => v.validateSecurity('application/x-msdownload', 'payload.exe')).toThrow('File type not allowed');
    expect(() => v.validateSecurity('application/x-bat', 'script.bat')).toThrow('File type not allowed');
  });

  test('validateSecurity allows custom blocked extensions', () => {
    const v = createStorageValidatorForTests({ blockedExtensions: ['zip'] });
    expect(() => v.validateSecurity('application/zip', 'archive.zip')).toThrow('File type not allowed');
    // exe is not in custom list, so allowed
    expect(() => v.validateSecurity('application/octet-stream', 'app.exe')).not.toThrow();
  });

  test('validateCategory enforces allowed categories', () => {
    const v = createStorageValidatorForTests({ allowedCategories: [FileCategory.IMAGE] });
    expect(() => v.validateCategory('image/png')).not.toThrow();
    expect(() => v.validateCategory('application/pdf')).toThrow('File category not allowed');
  });

  test('validateCategory allows all when no categories configured', () => {
    const v = createStorageValidatorForTests();
    expect(() => v.validateCategory('application/pdf')).not.toThrow();
    expect(() => v.validateCategory('video/mp4')).not.toThrow();
  });

  test('resolveMimeType delegates to standalone helper', () => {
    const v = createStorageValidatorForTests();
    expect(v.resolveMimeType('image/webp', 'photo.png')).toBe('image/webp');
    expect(v.resolveMimeType(undefined, 'photo.png')).toBe('image/png');
  });
});

// ===========================================================================
// Storage service — full CRUD
// ===========================================================================

describe('storage service CRUD', () => {
  test('save and get round-trip', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('hello'), 'text/plain');
    const data = await service.get('ns', 'file.txt');
    expect(data?.toString()).toBe('hello');
  });

  test('get returns null for missing files', async () => {
    const { service } = createTestContext();
    const data = await service.get('ns', 'missing.txt');
    expect(data).toBeNull();
  });

  test('getInfo returns file metadata', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'icon.png', Buffer.from('px'), 'image/png');
    const info = await service.getInfo('ns', 'icon.png');

    expect(info).not.toBeNull();
    expect(info!.namespace).toBe('ns');
    expect(info!.filePath).toBe('icon.png');
    expect(info!.mimeType).toBe('image/png');
    expect(info!.size).toBe(2);
    expect(info!.category).toBe(FileCategory.IMAGE);
  });

  test('getInfo returns null for missing files', async () => {
    const { service } = createTestContext();
    expect(await service.getInfo('ns', 'missing.txt')).toBeNull();
  });

  test('list returns files for namespace only', async () => {
    const { service } = createTestContext();

    await service.save('ns-a', 'a.txt', Buffer.from('a'), 'text/plain');
    await service.save('ns-a', 'b.txt', Buffer.from('b'), 'text/plain');
    await service.save('ns-b', 'c.txt', Buffer.from('c'), 'text/plain');

    const listA = await service.list('ns-a');
    expect(listA).toHaveLength(2);
    expect(listA.every((f) => f.namespace === 'ns-a')).toBe(true);

    const listB = await service.list('ns-b');
    expect(listB).toHaveLength(1);
  });

  test('list returns empty array for unknown namespace', async () => {
    const { service } = createTestContext();
    expect(await service.list('unknown')).toEqual([]);
  });

  test('delete removes file and returns true, false for missing', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('data'), 'text/plain');
    expect(await service.delete('ns', 'file.txt')).toBe(true);
    expect(await service.delete('ns', 'file.txt')).toBe(false);
  });

  test('deleteAll removes all files in namespace', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'a.txt', Buffer.from('a'), 'text/plain');
    await service.save('ns', 'b.txt', Buffer.from('b'), 'text/plain');
    await service.save('other', 'c.txt', Buffer.from('c'), 'text/plain');

    await service.deleteAll('ns');

    expect(await service.list('ns')).toEqual([]);
    expect(await service.list('other')).toHaveLength(1);
  });

  test('copy duplicates all files from source to target namespace', async () => {
    const { service } = createTestContext();

    await service.save('src', 'a.png', Buffer.from('img-a'), 'image/png');
    await service.save('src', 'b.png', Buffer.from('img-b'), 'image/png');

    await service.copy('src', 'dest');

    const destFiles = await service.list('dest');
    expect(destFiles).toHaveLength(2);
    expect(destFiles.every((f) => f.namespace === 'dest')).toBe(true);

    // source untouched
    expect(await service.list('src')).toHaveLength(2);

    // data integrity
    const copied = await service.get('dest', 'a.png');
    expect(copied?.toString()).toBe('img-a');
  });

  test('save overwrites existing file and preserves createdAt', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('v1'), 'text/plain');
    const info1 = await service.getInfo('ns', 'file.txt');

    await service.save('ns', 'file.txt', Buffer.from('v2-longer'), 'text/plain');
    const info2 = await service.getInfo('ns', 'file.txt');

    expect(info2!.size).toBe(9);
    expect(info2!.createdAt).toBe(info1!.createdAt);

    const data = await service.get('ns', 'file.txt');
    expect(data?.toString()).toBe('v2-longer');
  });
});

// ===========================================================================
// Storage service — save validation
// ===========================================================================

describe('storage service save validation', () => {
  test('rejects files exceeding max size', async () => {
    const { service } = createTestContext({ maxFileSize: 100 });
    const bigBuffer = Buffer.alloc(101);

    await expect(
      service.save('ns', 'big.txt', bigBuffer, 'text/plain'),
    ).rejects.toThrow('File too large');
  });

  test('rejects blocked extensions', async () => {
    const { service } = createTestContext();

    await expect(
      service.save('ns', 'malware.exe', Buffer.from('bad'), 'application/x-msdownload'),
    ).rejects.toThrow('File type not allowed');
  });

  test('rejects disallowed categories when configured', async () => {
    const { service } = createTestContext({ allowedCategories: [FileCategory.IMAGE] });

    await expect(
      service.save('ns', 'doc.pdf', Buffer.from('pdf'), 'application/pdf'),
    ).rejects.toThrow('File category not allowed');
  });

  test('allows valid files through validation', async () => {
    const { service } = createTestContext({ maxFileSize: 1024, allowedCategories: [FileCategory.IMAGE] });

    await service.save('ns', 'photo.png', Buffer.from('px'), 'image/png');
    const info = await service.getInfo('ns', 'photo.png');
    expect(info).not.toBeNull();
  });

  test('saveBase64 inherits save validation', async () => {
    const { service } = createTestContext({ maxFileSize: 5 });

    // 'hello' is 5 bytes — should pass
    await service.saveBase64('ns', 'small.png', Buffer.from('hello').toString('base64'));

    // 'hello!' is 6 bytes — should fail
    await expect(
      service.saveBase64('ns', 'big.png', Buffer.from('hello!').toString('base64')),
    ).rejects.toThrow('File too large');
  });
});

// ===========================================================================
// Storage service — event emission
// ===========================================================================

describe('storage service events', () => {
  test('emits storage.saved on successful save', async () => {
    const { service, events } = createTestContext();

    await service.save('ns', 'icon.png', Buffer.from('px'), 'image/png');

    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('storage.saved');
    expect(events[0]!.data).toEqual({
      namespace: 'ns',
      filePath: 'icon.png',
      mimeType: 'image/png',
      size: 2,
    });
  });

  test('does not emit event when save validation fails', async () => {
    const { service, events } = createTestContext({ maxFileSize: 1 });

    try {
      await service.save('ns', 'big.txt', Buffer.from('too large'), 'text/plain');
    } catch { /* expected */ }

    expect(events).toHaveLength(0);
  });

  test('emits storage.deleted on successful delete', async () => {
    const { service, events } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('data'), 'text/plain');
    events.length = 0; // clear save event

    await service.delete('ns', 'file.txt');

    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('storage.deleted');
    expect(events[0]!.data).toEqual({ namespace: 'ns', filePath: 'file.txt' });
  });

  test('does not emit event when deleting non-existent file', async () => {
    const { service, events } = createTestContext();

    await service.delete('ns', 'missing.txt');
    expect(events).toHaveLength(0);
  });

  test('emits storage.namespace.deleted on deleteAll', async () => {
    const { service, events } = createTestContext();

    await service.save('ns', 'a.txt', Buffer.from('a'), 'text/plain');
    events.length = 0;

    await service.deleteAll('ns');

    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('storage.namespace.deleted');
    expect(events[0]!.data).toEqual({ namespace: 'ns' });
  });
});

// ===========================================================================
// Storage service — convenience methods
// ===========================================================================

describe('storage service convenience methods', () => {
  test('saveBase64 stores decoded bytes and inferred mime type', async () => {
    const { service, files } = createTestContext();

    await service.saveBase64('book-1', 'images/pixel.png', Buffer.from('hello').toString('base64'));

    const saved = files.get('book-1/images/pixel.png');
    expect(saved).toBeDefined();
    expect(saved?.data.toString()).toBe('hello');
    expect(saved?.info.mimeType).toBe('image/png');
  });

  test('saveBase64 keeps explicit mime type when provided', async () => {
    const { service, files } = createTestContext();

    await service.saveBase64('book-1', 'images/pixel.png', Buffer.from('hello').toString('base64'), 'image/webp');

    const saved = files.get('book-1/images/pixel.png');
    expect(saved?.info.mimeType).toBe('image/webp');
  });

  test('saveBase64 rejects invalid base64 payloads', async () => {
    const { service } = createTestContext();
    await expect(service.saveBase64('book-1', 'images/pixel.png', 'not base64***')).rejects.toThrow('Invalid base64 data');
  });

  test('saveBase64 normalizes file path', async () => {
    const { service, files } = createTestContext();

    await service.saveBase64('ns', '/icons%2Fstar.png', Buffer.from('px').toString('base64'));

    expect(files.has('ns/icons/star.png')).toBe(true);
  });

  test('getInfoOrThrow returns info for existing file', async () => {
    const { service } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('data'), 'text/plain');
    const info = await service.getInfoOrThrow('ns', 'file.txt');
    expect(info.filePath).toBe('file.txt');
  });

  test('getInfoOrThrow throws for missing file', async () => {
    const { service } = createTestContext();
    await expect(service.getInfoOrThrow('ns', 'missing.png')).rejects.toThrow('File not found: missing.png');
  });

  test('getInfoOrThrow uses custom error message', async () => {
    const { service } = createTestContext();
    await expect(service.getInfoOrThrow('ns', 'x.png', 'Custom error')).rejects.toThrow('Custom error');
  });

  test('deleteOrThrow removes existing file', async () => {
    const { service, files } = createTestContext();

    await service.save('ns', 'file.txt', Buffer.from('data'), 'text/plain');
    await service.deleteOrThrow('ns', 'file.txt');
    expect(files.has('ns/file.txt')).toBe(false);
  });

  test('deleteOrThrow throws for missing file', async () => {
    const { service } = createTestContext();
    await expect(service.deleteOrThrow('ns', 'missing.png')).rejects.toThrow('File not found: missing.png');
  });
});

// ===========================================================================
// Storage plugin
// ===========================================================================

describe('storage plugin MCP toggle', () => {
  test('requires an explicit public or guarded route decision', () => {
    expect(() => storage()).toThrow('storage.guards must be configured explicitly');
  });

  test('allows explicitly public storage routes with guards: []', () => {
    const plugin = storage({ guards: [] });

    const deps = (plugin.dependencies ?? []).filter((dep) => typeof dep === 'string');
    expect(deps).not.toContain('guards');
  });

  test('requires guard plugin when storage route guards are configured', () => {
    const guard = (() => () => {}) as any;
    const plugin = storage({ guards: [guard()] });

    const deps = (plugin.dependencies ?? []).filter((dep) => typeof dep === 'string');
    expect(deps).toContain('guards');
  });

  test('does not register MCP requirements by default', () => {
    const plugin = storage({ guards: [] });

    const deps = (plugin.dependencies ?? []).filter((dep) => typeof dep === 'string');
    expect(deps).not.toContain('mcp');
    expect(plugin.services ?? []).not.toContain(StorageMcpTools);
  });

  test('registers MCP requirements and services when enabled', () => {
    const plugin = storage({ mcp: true, guards: [] });

    const deps = (plugin.dependencies ?? []).filter((dep) => typeof dep === 'string');
    expect(deps).toContain('mcp');
    expect(plugin.services ?? []).toContain(StorageMcpTools);
  });
});

// ===========================================================================
// MCP tools
// ===========================================================================

describe('storage MCP tools', () => {
  test('registers all MCP tools during activate', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service) as any;

    const registered: Array<{ name: string; annotations?: any }> = [];

    // `has` before `resolve`: tools are resolved through
    // `Symbol.for('najm:mcp:registry')`, and the registration check is what
    // separates "mcp() was never registered" from a registry that failed to
    // construct.
    const checkedTokens: unknown[] = [];
    const resolvedTokens: unknown[] = [];
    tools.container = {
      has: (token: unknown) => {
        checkedTokens.push(token);
        return true;
      },
      resolve: async (token: unknown) => {
        resolvedTokens.push(token);
        return {
        registerTool: (tool: { name: string; annotations?: any }) => registered.push(tool),
        };
      },
    };

    await tools.activate();

    expect(registered.map((t) => t.name).sort()).toEqual([
      'storage_delete',
      'storage_info',
      'storage_list',
      'storage_upload',
      'storage_upload_from_path',
    ]);
    expect(checkedTokens).toEqual([MCP_REGISTRY]);
    expect(resolvedTokens).toEqual([MCP_REGISTRY]);

    // verify annotations
    const listTool = registered.find((t) => t.name === 'storage_list');
    expect(listTool?.annotations?.readOnlyHint).toBe(true);

    const deleteTool = registered.find((t) => t.name === 'storage_delete');
    expect(deleteTool?.annotations?.destructiveHint).toBe(true);

    const uploadTool = registered.find((t) => t.name === 'storage_upload');
    expect(uploadTool?.annotations?.idempotentHint).toBe(true);
  });

  test('reports a missing MCP plugin before attempting resolution', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service) as any;
    let resolved = false;

    tools.container = {
      has: (token: unknown) => token === MCP_REGISTRY ? false : true,
      resolve: async () => {
        resolved = true;
        return {};
      },
    };

    await expect(tools.activate()).rejects.toThrow('Register mcp() before storage({ mcp: true })');
    expect(resolved).toBe(false);
  });

  test('preserves MCP registry construction errors', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service) as any;
    const constructionError = new Error('registry construction failed');

    tools.container = {
      has: (token: unknown) => token === MCP_REGISTRY,
      resolve: async (token: unknown) => {
        expect(token).toBe(MCP_REGISTRY);
        throw constructionError;
      },
    };

    await expect(tools.activate()).rejects.toBe(constructionError);
  });

  test('activate is idempotent — second call does not re-register', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service) as any;

    const registered: Array<{ name: string }> = [];

    tools.container = {
      has: () => true,
      resolve: async () => ({
        registerTool: (tool: { name: string }) => registered.push(tool),
      }),
    };

    await tools.activate();
    await tools.activate();

    expect(registered).toHaveLength(5);
  });

  test('storage_list returns files for namespace', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    await service.save('book-1', 'images/cover.png', Buffer.from('cover'), 'image/png');
    await service.save('book-2', 'images/cover.png', Buffer.from('cover2'), 'image/png');

    const files = await tools.storageList({ namespace: 'book-1' });
    expect(files).toHaveLength(1);
    expect(files[0]?.namespace).toBe('book-1');
  });

  test('storage_list returns empty for unknown namespace', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    const files = await tools.storageList({ namespace: 'unknown' });
    expect(files).toHaveLength(0);
  });

  test('storage_list rejects invalid namespace', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    await expect(tools.storageList({ namespace: '../etc' })).rejects.toThrow('Invalid namespace');
  });

  test('storage_info returns metadata and throws for missing files', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    await service.save('book-1', 'docs/readme.txt', Buffer.from('hello'), 'text/plain');

    const info = await tools.storageInfo({ namespace: 'book-1', filePath: 'docs/readme.txt' });
    expect(info.filePath).toBe('docs/readme.txt');
    expect(info.mimeType).toBe('text/plain');
    expect(info.size).toBe(5);

    await expect(tools.storageInfo({ namespace: 'book-1', filePath: 'docs/missing.txt' })).rejects.toThrow('File not found');
  });

  test('storage_info rejects path traversal in filePath', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    await expect(tools.storageInfo({ namespace: 'book-1', filePath: '../secret.txt' })).rejects.toThrow('path traversal');
  });

  test('storage_upload saves base64 content and returns file info', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    const file = await tools.storageUpload({
      namespace: 'book-1',
      filePath: 'images/pixel.png',
      base64Data: Buffer.from('hello').toString('base64'),
    });

    expect(file.namespace).toBe('book-1');
    expect(file.filePath).toBe('images/pixel.png');
    expect(file.size).toBe(5);
    expect(file.mimeType).toBe('image/png');
  });

  test('storage_upload rejects invalid base64', async () => {
    const { service } = createTestContext();
    const tools = new StorageMcpTools(service);

    await expect(
      tools.storageUpload({
        namespace: 'book-1',
        filePath: 'images/bad.png',
        base64Data: 'not base64***',
      }),
    ).rejects.toThrow('Invalid base64 data');
  });

  test('storage_upload enforces size limits', async () => {
    const { service } = createTestContext({ maxFileSize: 3 });
    const tools = new StorageMcpTools(service);

    await expect(
      tools.storageUpload({
        namespace: 'ns',
        filePath: 'big.png',
        base64Data: Buffer.from('toolarge').toString('base64'),
      }),
    ).rejects.toThrow('File too large');
  });

  test('storage_delete removes file and throws for missing files', async () => {
    const { service, files } = createTestContext();
    const tools = new StorageMcpTools(service);

    await service.save('book-1', 'images/remove.png', Buffer.from('bye'), 'image/png');

    const result = await tools.storageDelete({ namespace: 'book-1', filePath: 'images/remove.png' });
    expect(result.message).toBe('File deleted');
    expect(files.has('book-1/images/remove.png')).toBe(false);

    await expect(tools.storageDelete({ namespace: 'book-1', filePath: 'images/missing.png' })).rejects.toThrow('File not found');
  });
});
