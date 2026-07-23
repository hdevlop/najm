import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalStorageProvider } from '../src/providers/LocalStorageProvider';
import { FileCategory, StorageService } from '../src';
import type { PreviewOptions } from '../src';
import { createHash } from 'crypto';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'najm-storage-preview-'));
}

function createTestImageBuffer(): Buffer {
  // Minimal 1x1 GIF — enough to be recognized as an image by sharp if present,
  // and small enough to not matter if sharp is absent.
  return Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );
}

function createServiceWithPreview(enabled: boolean, overrides?: Partial<PreviewOptions & { cacheDir?: string; maxCacheBytes?: number }>): StorageService {
  const service = new StorageService() as any;
  service.config = {
    preview: {
      enabled,
      cacheDir: overrides?.cacheDir ?? '.thumbnails',
      defaultQuality: 80,
      maxDimension: 2048,
      maxCacheBytes: overrides?.maxCacheBytes,
    },
    servePrefix: '/api',
  };
  return service as StorageService;
}

describe('preview URL construction', () => {
  test('getPreviewPath builds direct preview URL with query params', () => {
    const service = createServiceWithPreview(true);
    const url = service.getPreviewPath('bucket', 'photo.png', { width: 200, height: 200, quality: 85, format: 'webp', fit: 'cover' });
    expect(url).toBe('/api/bucket/files/preview/photo.png?w=200&h=200&q=85&format=webp&fit=cover');
  });

  test('getPreviewPath omits undefined options', () => {
    const service = createServiceWithPreview(true);
    const url = service.getPreviewPath('bucket', 'photo.png', { width: 100 });
    expect(url).toBe('/api/bucket/files/preview/photo.png?w=100');
  });

  test('getPreviewPath returns bare path when no options', () => {
    const service = createServiceWithPreview(true);
    const url = service.getPreviewPath('bucket', 'photo.png');
    expect(url).toBe('/api/bucket/files/preview/photo.png');
  });

  test('getPreviewPath encodes path segments', () => {
    const service = createServiceWithPreview(true);
    const url = service.getPreviewPath('my bucket', 'folder/a #1%.png', { width: 64 });
    expect(url).toBe('/api/my%20bucket/files/preview/folder/a%20%231%25.png?w=64');
  });
});

describe('servePreview fallback behavior', () => {
  test('returns null when preview is disabled', async () => {
    const service = createServiceWithPreview(false);
    service.provider = {
      async getInfo() {
        return {
          namespace: 'ns',
          filePath: 'img.png',
          mimeType: 'image/png',
          size: 10,
          category: FileCategory.IMAGE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    } as any;
    service.validator = {
      resolveTarget: (_ns: string, path: string) => ({ namespace: 'ns', filePath: path }),
      ensureFileExists: (info: any) => info,
    } as any;

    const result = await service.servePreview('ns', 'img.png', { width: 100 });
    expect(result).toBeNull();
  });

  test('returns null for non-image files', async () => {
    const service = createServiceWithPreview(true);
    service.provider = {
      async getInfo() {
        return {
          namespace: 'ns',
          filePath: 'doc.pdf',
          mimeType: 'application/pdf',
          size: 10,
          category: FileCategory.PDF,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    } as any;
    service.validator = {
      resolveTarget: (_ns: string, path: string) => ({ namespace: 'ns', filePath: path }),
      ensureFileExists: (info: any) => info,
    } as any;

    const result = await service.servePreview('ns', 'doc.pdf', { width: 100 });
    expect(result).toBeNull();
  });

  test('returns null when provider does not support getPreview', async () => {
    const service = createServiceWithPreview(true);
    service.provider = {
      async getInfo() {
        return {
          namespace: 'ns',
          filePath: 'img.png',
          mimeType: 'image/png',
          size: 10,
          category: FileCategory.IMAGE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      // no getPreview
    } as any;
    service.validator = {
      resolveTarget: (_ns: string, path: string) => ({ namespace: 'ns', filePath: path }),
      ensureFileExists: (info: any) => info,
    } as any;

    const result = await service.servePreview('ns', 'img.png', { width: 100 });
    expect(result).toBeNull();
  });

  test('clamps preview options before calling provider', async () => {
    const service = createServiceWithPreview(true);
    (service as any).config.preview.maxDimension = 128;
    let received: PreviewOptions | undefined;
    service.provider = {
      async getInfo() {
        return {
          namespace: 'ns',
          filePath: 'img.png',
          mimeType: 'image/png',
          size: 10,
          category: FileCategory.IMAGE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      async getPreview(_namespace: string, _filePath: string, options: PreviewOptions) {
        received = options;
        return new Uint8Array([1, 2, 3]);
      },
    } as any;
    service.validator = {
      resolveTarget: (_ns: string, path: string) => ({ namespace: 'ns', filePath: path }),
      ensureFileExists: (info: any) => info,
    } as any;

    const result = await service.servePreview('ns', 'img.png', { width: 999, height: 0, quality: -5, format: 'webp', fit: 'cover' });
    expect(result).toBeInstanceOf(Response);
    expect(received).toEqual({ width: 128, height: 1, quality: 1, format: 'webp', fit: 'cover' });
  });
});

describe('LocalStorageProvider preview', () => {
  let tmpDir: string;
  let provider: LocalStorageProvider;

  beforeEach(() => {
    tmpDir = makeTempDir();
    provider = new LocalStorageProvider(tmpDir, {
      enabled: true,
      cacheDir: '.thumbnails',
      defaultQuality: 80,
      maxDimension: 2048,
    });
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore cleanup errors */ }
  });

  test('getPreview returns null when preview is disabled', async () => {
    const disabledProvider = new LocalStorageProvider(tmpDir, { enabled: false });
    await disabledProvider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');
    const result = await disabledProvider.getPreview('ns', 'img.png', { width: 100 });
    expect(result).toBeNull();
  });

  test('custom cache directories are hidden from storage reads', async () => {
    const customProvider = new LocalStorageProvider(tmpDir, {
      enabled: true,
      cacheDir: 'cache/thumbnails',
      defaultQuality: 80,
      maxDimension: 2048,
    });
    mkdirSync(join(tmpDir, '.cache', 'thumbnails', 'ns'), { recursive: true });
    writeFileSync(join(tmpDir, '.cache', 'thumbnails', 'ns', 'thumb.webp'), Buffer.from('cached'));

    expect(await customProvider.get('.cache', 'thumbnails/ns/thumb.webp')).toBeNull();
    expect(await customProvider.list('.cache')).toEqual([]);
    expect(await customProvider.listObjects('.cache')).toEqual({ files: [], folders: [] });
  });

  test('getPreview returns null for non-image files', async () => {
    await provider.save('ns', 'doc.txt', Buffer.from('hello'), 'text/plain');
    const result = await provider.getPreview('ns', 'doc.txt', { width: 100 });
    expect(result).toBeNull();
  });

  test('getPreview gracefully returns null when sharp is not installed', async () => {
    // We simulate sharp absence by using a provider with a custom preview config
    // but the actual absence of sharp cannot be forced easily. However, the
    // LocalStorageProvider already catches import errors and returns null.
    // In CI environments without sharp, this test will exercise that path.
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');
    const result = await provider.getPreview('ns', 'img.png', { width: 100 });
    // If sharp is present, we get a Uint8Array; if absent, null.
    // We only assert that it does not throw.
    expect(result === null || result instanceof Uint8Array).toBe(true);
  });

  test('cache is written and hit on second request', async () => {
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');

    const first = await provider.getPreview('ns', 'img.png', { width: 64, height: 64, format: 'webp' });
    if (!first) {
      // sharp not installed — skip cache assertions
      return;
    }

    // Cache directory should contain the thumbnail
    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    expect(existsSync(cacheDir)).toBe(true);
    const files = readdirSync(cacheDir);
    expect(files.length).toBeGreaterThan(0);

    // Second request should read from cache (no error, same result)
    const second = await provider.getPreview('ns', 'img.png', { width: 64, height: 64, format: 'webp' });
    expect(second).not.toBeNull();
    expect(second!.length).toBe(first.length);
  });

  test('save invalidates cached preview', async () => {
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');

    const first = await provider.getPreview('ns', 'img.png', { width: 64, format: 'webp' });
    if (!first) return; // sharp not installed

    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    const before = readdirSync(cacheDir);
    expect(before.length).toBeGreaterThan(0);

    // Overwrite the file
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');

    const after = readdirSync(cacheDir);
    expect(after.length).toBe(0);
  });

  test('delete invalidates cached preview', async () => {
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');

    const first = await provider.getPreview('ns', 'img.png', { width: 64, format: 'webp' });
    if (!first) return; // sharp not installed

    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    expect(readdirSync(cacheDir).length).toBeGreaterThan(0);

    await provider.delete('ns', 'img.png');
    expect(readdirSync(cacheDir).length).toBe(0);
  });

  test('move invalidates cached preview for source and target', async () => {
    await provider.save('ns', 'a.png', createTestImageBuffer(), 'image/png');

    const first = await provider.getPreview('ns', 'a.png', { width: 64, format: 'webp' });
    if (!first) return; // sharp not installed

    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    expect(readdirSync(cacheDir).length).toBeGreaterThan(0);

    await provider.move('ns', 'a.png', 'b.png');
    expect(readdirSync(cacheDir).length).toBe(0);
  });

  test('copyFile invalidates cached preview for target', async () => {
    await provider.save('ns', 'a.png', createTestImageBuffer(), 'image/png');

    const first = await provider.getPreview('ns', 'a.png', { width: 64, format: 'webp' });
    if (!first) return; // sharp not installed

    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    const beforeCount = readdirSync(cacheDir).length;
    expect(beforeCount).toBeGreaterThan(0);

    await provider.copyFile('ns', 'a.png', 'b.png');
    // Target cache should be cleared; source cache may remain
    const after = readdirSync(cacheDir);
    const hashB = createHash('md5').update('ns/b.png').digest('hex').slice(0, 16);
    expect(after.every((f) => !f.startsWith(hashB + '_'))).toBe(true);
  });

  test('concurrent requests do not create duplicate cache files', async () => {
    await provider.save('ns', 'img.png', createTestImageBuffer(), 'image/png');

    // Use a unique size that hasn't been cached yet
    const opts: PreviewOptions = { width: 99, format: 'webp' };
    const [r1, r2] = await Promise.all([
      provider.getPreview('ns', 'img.png', opts),
      provider.getPreview('ns', 'img.png', opts),
    ]);
    if (!r1 || !r2) return; // sharp not installed

    // Only one cache file should exist for these options
    const cacheDir = join(tmpDir, '.thumbnails', 'ns');
    const entries = readdirSync(cacheDir).filter((f) => f.includes('_99x0_'));
    expect(entries.length).toBe(1);
  });
});
