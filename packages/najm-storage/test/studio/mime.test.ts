import { describe, test, expect } from 'bun:test';
import { getFileIcon, getFileColor } from '../../src/studio/lib/mime';
import { Image, Film, FileCode, FileText, FileArchive, File } from 'lucide-react';

describe('getFileIcon', () => {
  test('returns Image for image types', () => {
    expect(getFileIcon('image/png')).toBe(Image);
  });

  test('returns Film for video types', () => {
    expect(getFileIcon('video/mp4')).toBe(Film);
  });

  test('returns FileCode for text and code types', () => {
    expect(getFileIcon('text/plain')).toBe(FileCode);
    expect(getFileIcon('application/json')).toBe(FileCode);
  });

  test('returns FileText for documents', () => {
    expect(getFileIcon('application/pdf')).toBe(FileText);
  });

  test('returns FileArchive for archives', () => {
    expect(getFileIcon('application/zip')).toBe(FileArchive);
  });

  test('returns File for unknown types', () => {
    expect(getFileIcon('application/octet-stream')).toBe(File);
  });
});

describe('getFileColor', () => {
  test('returns purple for images', () => {
    expect(getFileColor('image/png')).toBe('text-purple-400');
  });

  test('returns red for videos', () => {
    expect(getFileColor('video/mp4')).toBe('text-red-400');
  });

  test('returns green for text/code', () => {
    expect(getFileColor('application/json')).toBe('text-green-400');
  });

  test('returns gray for unknown', () => {
    expect(getFileColor('application/octet-stream')).toBe('text-gray-400');
  });
});
