import { describe, test, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useUpload } from '../src/hooks/useUpload';
import { StorageStudioProvider } from '../src/provider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StorageStudioProvider apiBase="http://localhost:3100/api/storage-studio" storageApiBase="http://localhost:3100/api">
    {children}
  </StorageStudioProvider>
);

describe('useUpload', () => {
  test('addFiles creates queued tasks', () => {
    const { result } = renderHook(() => useUpload('test-bucket'), { wrapper });
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    act(() => result.current.addFiles([file] as unknown as FileList, 'test-bucket'));

    expect(result.current.queue.length).toBe(1);
    expect(result.current.queue[0].status).toBe('queued');
    expect(result.current.queue[0].file.name).toBe('test.txt');
  });

  test('removeTask drops task from queue', () => {
    const { result } = renderHook(() => useUpload('test-bucket'), { wrapper });
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });

    act(() => result.current.addFiles([file] as unknown as FileList, 'test-bucket'));
    const id = result.current.queue[0].id;

    act(() => result.current.removeTask(id));

    expect(result.current.queue.length).toBe(0);
  });

  test('addFiles ignores null input', () => {
    const { result } = renderHook(() => useUpload('test-bucket'), { wrapper });

    act(() => result.current.addFiles(null, 'test-bucket'));

    expect(result.current.queue.length).toBe(0);
  });

  test('addFiles ignores empty FileList', () => {
    const { result } = renderHook(() => useUpload('test-bucket'), { wrapper });

    act(() => result.current.addFiles([] as unknown as FileList, 'test-bucket'));

    expect(result.current.queue.length).toBe(0);
  });
});