import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalStorageProvider } from '../src/providers/LocalStorageProvider';

describe('folder placeholders', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  test('keeps created folders visible without exposing .keep as a file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'najm-storage-folder-'));
    const provider = new LocalStorageProvider(tempDir);

    await provider.save('assets', 'photos/.keep', Buffer.alloc(0), 'application/octet-stream');
    await provider.save('assets', 'photos/image.png', Buffer.from('image'), 'image/png');

    expect(await provider.listObjects('assets', { delimiter: '/' })).toMatchObject({
      folders: ['photos/'],
    });

    let photos = await provider.listObjects('assets', { prefix: 'photos/', delimiter: '/' });
    expect(photos.files.map((file) => file.filePath)).toEqual(['photos/image.png']);

    await provider.delete('assets', 'photos/image.png');

    expect(await provider.listObjects('assets', { delimiter: '/' })).toMatchObject({
      folders: ['photos/'],
    });

    photos = await provider.listObjects('assets', { prefix: 'photos/', delimiter: '/' });
    expect(photos.files).toEqual([]);
    expect(photos.folders).toEqual([]);
  });
});
