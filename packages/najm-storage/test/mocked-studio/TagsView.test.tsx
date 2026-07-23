import { describe, test, expect, mock, beforeEach } from 'bun:test';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mockUpdateTag = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve({}));
const mockCreateTag = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve({}));
const mockDeleteTag = mock<(...args: any[]) => Promise<any>>(() => Promise.resolve({ success: true }));
const mockMutateTags = mock<() => Promise<any>>(() => Promise.resolve([]));

let swrData: Map<string, any> = new Map();

const stableApi = {
  createTag: mockCreateTag,
  updateTag: mockUpdateTag,
  deleteTag: mockDeleteTag,
  getFileTags: mock(() => Promise.resolve([])),
  setFileTags: mock(() => Promise.resolve([])),
  patchFileTags: mock(() => Promise.resolve({ updated: [], failed: [] })),
  listTags: mock(() => Promise.resolve([])),
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

mock.module('../../src/studio/features/tags/hooks/useTagCapabilities', () => ({
  useTagCapabilities: () => ({ data: { tags: true, presign: false, trash: false, buckets: false } }),
}));

mock.module('../../src/studio/features/dashboard/hooks/useBuckets', () => ({
  useBuckets: () => ({
    data: [{ name: 'test-bucket' }, { name: 'other-bucket' }],
  }),
}));

mock.module('sonner', () => ({
  toast: { error: mock(() => {}), success: mock(() => {}), info: mock(() => {}) },
}));

mock.module('../../src/studio/features/tags/components/tagsViewUi', () => ({
  NEmptyState: ({ title }: any) => <div data-testid="empty-state">{title}</div>,
  NTable: ({ data, columns, renderEmpty }: any) => {
    if (!data || data.length === 0) return renderEmpty?.() ?? <div>No data</div>;
    return (
      <table>
        <tbody>
          {data.map((row: any) => (
            <tr key={row.id}>
              {columns.map((col: any) => (
                <td key={col.id ?? col.accessorKey}>
                  {col.cell ? col.cell({ row: { original: row } }) : row[col.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  NPageHeader: ({ title, subtitle, actions, filters, children }: any) => (
    <div>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {actions}
        {filters}
      </div>
      {children}
    </div>
  ),
  NConfirmDialog: ({ open, onConfirm, title, confirmLabel }: any) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button data-testid="confirm-btn" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    );
  },
}));

import { TagsView } from '../../src/studio/features/tags/components/TagsView';
import { StorageStudioProvider } from '../../src/studio/providers';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
      {children}
    </StorageStudioProvider>
  );
}

describe('TagsView', () => {
  beforeEach(() => {
    swrData.clear();
    mockCreateTag.mockClear();
    mockUpdateTag.mockClear();
    mockDeleteTag.mockClear();
    mockMutateTags.mockClear();
  });

  test('renders Tags header', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );
    expect(screen.getByText('Tags')).toBeDefined();
  });

  test('renders bucket selector', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('test-bucket');
  });

  test('renders New Tag button', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );
    expect(screen.getByText('New Tag')).toBeDefined();
  });

  test('renders empty state when no tags', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );
    expect(screen.getByText('No tags yet')).toBeDefined();
  });

  test('renders tag rows with name and count', () => {
    swrData.set('tags:test-bucket', [
      { id: 'test-bucket:tag:alpha', namespace: 'test-bucket', name: 'alpha', color: null, count: 3 },
      { id: 'test-bucket:tag:beta', namespace: 'test-bucket', name: 'beta', color: '#ff0000', count: 1 },
    ]);

    render(
      <Wrapper><TagsView /></Wrapper>
    );

    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('beta')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  test('renders color dot for tags with color', () => {
    swrData.set('tags:test-bucket', [
      { id: 'test-bucket:tag:red', namespace: 'test-bucket', name: 'red', color: '#ff0000', count: 0 },
    ]);

    const { container } = render(
      <Wrapper><TagsView /></Wrapper>
    );

    const dot = container.querySelector('[style="background-color: #ff0000;"]');
    expect(dot).toBeTruthy();
  });

  test('clicking New Tag opens create dialog', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );

    fireEvent.click(screen.getByText('New Tag'));
    expect(screen.getByText('Create Tag')).toBeDefined();
  });

  test('create dialog has name input and create button', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );

    fireEvent.click(screen.getByText('New Tag'));
    expect(screen.getByPlaceholderText('Tag name')).toBeDefined();
    expect(screen.getByText('Create')).toBeDefined();
  });

  test('closing create dialog works', () => {
    swrData.set('tags:test-bucket', []);
    render(
      <Wrapper><TagsView /></Wrapper>
    );

    fireEvent.click(screen.getByText('New Tag'));
    expect(screen.getByText('Create Tag')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Create Tag')).toBeNull();
  });

  test('clicking Edit opens edit dialog with pre-filled data', () => {
    swrData.set('tags:test-bucket', [
      { id: 'test-bucket:tag:alpha', namespace: 'test-bucket', name: 'alpha', color: '#00ff00', count: 2 },
    ]);

    render(
      <Wrapper><TagsView /></Wrapper>
    );

    const editBtns = screen.getAllByText('Edit');
    fireEvent.click(editBtns[0]);
    expect(screen.getByText('Edit Tag')).toBeDefined();
  });

  test('clicking delete button opens confirm dialog', () => {
    swrData.set('tags:test-bucket', [
      { id: 'test-bucket:tag:alpha', namespace: 'test-bucket', name: 'alpha', color: null, count: 0 },
    ]);

    const { container } = render(
      <Wrapper><TagsView /></Wrapper>
    );

    const destructiveBtns = container.querySelectorAll('button[variant="destructive"]');
    expect(destructiveBtns.length).toBe(1);
    fireEvent.click(destructiveBtns[0]);

    expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
    expect(screen.getByText(/Delete tag "alpha"/)).toBeDefined();
    expect(screen.getByTestId('confirm-btn')).toBeTruthy();
  });
});
