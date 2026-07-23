import { describe, test, expect, mock, beforeEach } from 'bun:test';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mockSetTags = mock<(tags: string[]) => Promise<any>>(() => Promise.resolve([]));
const mockMutateTags = mock<() => Promise<any>>(() => Promise.resolve([]));
const mockCreateTag = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve({}));
const mockGetFileTags = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve([]));
const mockPatchFileTags = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve({ updated: [], failed: [] }));

let swrData: Map<string, any> = new Map();

const stableApi = {
  createTag: mockCreateTag,
  getFileTags: mockGetFileTags,
  setFileTags: mockSetTags,
  patchFileTags: mockPatchFileTags,
  listTags: mock(() => Promise.resolve([])),
  deleteTag: mock(() => Promise.resolve({ success: true })),
  listFilesByTag: mock(() => Promise.resolve({ files: [] })),
  getCapabilities: mock(() => Promise.resolve({ tags: true, presign: false, trash: false, buckets: false })),
};

mock.module('../../src/studio/features/tags/api', () => ({
  useTagApi: () => stableApi,
}));

mock.module('../../src/studio/features/tags/hooks/useTags', () => ({
  useTags: (namespace: string | null) => {
    if (!namespace) return { data: [], mutate: mockMutateTags };
    return { data: swrData.get(`tags:${namespace}`) ?? [], mutate: mockMutateTags };
  },
}));

mock.module('../../src/studio/features/tags/hooks/useFileTags', () => ({
  useFileTags: (namespace: string, filePath: string | null) => {
    if (!filePath) return { tags: [], setTags: mockSetTags, isLoading: false };
    const tags = swrData.get(`fileTags:${namespace}:${filePath}`) ?? [];
    return { tags, setTags: mockSetTags, isLoading: false };
  },
}));

mock.module('sonner', () => ({
  toast: { error: mock(() => {}), success: mock(() => {}), info: mock(() => {}) },
}));

mock.module('najm-kit', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="dialog">
        <button data-testid="dialog-close" onClick={() => onOpenChange?.(false)}>Close</button>
        {children}
      </div>
    );
  },
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  NSheet: ({ children, open, title, onOpenChange }: any) => {
    if (!open) return null;
    return (
      <div data-testid="sheet">
        <div>{title}</div>
        <button data-testid="sheet-close" onClick={() => onOpenChange?.(false)}>Close</button>
        {children}
      </div>
    );
  },
}));

import { TagEditorSheet } from '../../src/studio/features/tags/components/TagEditorSheet';
import { StorageStudioProvider } from '../../src/studio/providers';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
      {children}
    </StorageStudioProvider>
  );
}

describe('TagEditorSheet', () => {
  beforeEach(() => {
    swrData.clear();
    mockSetTags.mockClear();
    mockMutateTags.mockClear();
    mockCreateTag.mockClear();
    mockGetFileTags.mockClear();
    mockPatchFileTags.mockClear();
  });

  test('returns null when open=false', () => {
    const { container } = render(
      <Wrapper>
        <TagEditorSheet open={false} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders title in single-file mode', () => {
    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );
    expect(screen.getByText('Edit Tags')).toBeDefined();
  });

  test('renders title with file count in multi-file mode', () => {
    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt', '/b.txt', '/c.txt']} onClose={() => {}} />
      </Wrapper>
    );
    expect(screen.getByText('Edit Tags (3 files)')).toBeDefined();
  });

  test('shows existing tags as chips in single-file mode', () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', [
      { id: 'ns:tag:alpha', namespace: 'ns', name: 'alpha', color: null },
      { id: 'ns:tag:beta', namespace: 'ns', name: 'beta', color: '#ff0000' },
    ]);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('beta')).toBeDefined();
  });

  test('shows "No tags assigned" when file has no tags', () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    expect(screen.getByText('No tags assigned')).toBeDefined();
  });

  test('shows "No tags assigned to the selected files" in multi-file mode with no tags', async () => {
    swrData.set('tags:ns', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt', '/b.txt']} onClose={() => {}} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No tags assigned to the selected files')).toBeDefined();
    });
  });

  test('shows Apply/Cancel buttons in multi-file mode', async () => {
    swrData.set('tags:ns', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt', '/b.txt']} onClose={() => {}} />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Apply')).toBeDefined();
    });
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  test('does not show Apply/Cancel in single-file mode', () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    expect(screen.queryByText('Apply')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  test('shows Create button when typing a new tag name', () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    const input = screen.getByPlaceholderText('Add or create a tag...');
    fireEvent.change(input, { target: { value: 'newtag' } });

    expect(screen.getByText('Create')).toBeDefined();
  });

  test('does not show Create button when input matches existing tag', () => {
    swrData.set('tags:ns', [{ id: 'ns:tag:alpha', namespace: 'ns', name: 'alpha', color: null }]);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    const input = screen.getByPlaceholderText('Add or create a tag...');
    fireEvent.change(input, { target: { value: 'alpha' } });

    expect(screen.queryByText('Create')).toBeNull();
  });

  test('removing a tag in single-file mode calls setTags', async () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', [
      { id: 'ns:tag:alpha', namespace: 'ns', name: 'alpha', color: null },
    ]);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    const removeBtn = screen.getByLabelText('Remove alpha');
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(mockSetTags).toHaveBeenCalledWith([]);
  });

  test('backdrop click calls onClose', () => {
    const onClose = mock();
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', []);

    const { container } = render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={onClose} />
      </Wrapper>
    );

    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  test('close button calls onClose', () => {
    const onClose = mock();
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={onClose} />
      </Wrapper>
    );

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  test('shows color dot for tags with color property', () => {
    swrData.set('tags:ns', []);
    swrData.set('fileTags:ns:/a.txt', [
      { id: 'ns:tag:red', namespace: 'ns', name: 'red', color: '#ff0000' },
    ]);

    const { container } = render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    const colorDot = container.querySelector('[style="background-color: #ff0000;"]');
    expect(colorDot).toBeTruthy();
  });

  test('shows autocomplete suggestions when typing', () => {
    swrData.set('tags:ns', [
      { id: 'ns:tag:document', namespace: 'ns', name: 'document', color: null, count: 5 },
      { id: 'ns:tag:draft', namespace: 'ns', name: 'draft', color: null, count: 2 },
    ]);
    swrData.set('fileTags:ns:/a.txt', []);

    render(
      <Wrapper>
        <TagEditorSheet open={true} namespace="ns" paths={['/a.txt']} onClose={() => {}} />
      </Wrapper>
    );

    const input = screen.getByPlaceholderText('Add or create a tag...');
    fireEvent.change(input, { target: { value: 'doc' } });

    expect(screen.getByText('document')).toBeDefined();
  });
});
