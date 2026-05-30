import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { FileBrowser } from '../../src/studio/features/explorer/components/FileBrowser';
import { StorageStudioProvider } from '../../src/studio/providers';
import type { FileItem } from '../../src/studio/features/explorer/types';

// Re-export the drag handlers type for use in test
const makeFiles = (count: number): FileItem[] =>
  Array.from({ length: count }, (_, i) => ({
    namespace: 'test',
    filePath: `/folder/file${i}.txt`,
    mimeType: 'text/plain',
    size: 1024 * (i + 1),
    updatedAt: new Date().toISOString(),
    tags: i % 2 === 0 ? ['tag-a'] : [],
  }));

const folders = ['/folder/subfolder'];

// Smoke test: just render to verify build correctness without hitting MutationObserver
describe('FileBrowser smoke test', () => {
  test('FileBrowser module can be imported and instantiated', () => {
    const onSelectAll = mock();
    const onNavigate = mock();
    const onRowContextMenu = mock();
    const onMoveToFolder = mock();

    // Minimal render to confirm the module works
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(1)}
            folders={folders}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={onSelectAll}
            onNavigate={onNavigate}
            onRowContextMenu={onRowContextMenu}
            onMoveToFolder={onMoveToFolder}
          />
        </div>
      </StorageStudioProvider>
    );
    // If we get here without throwing, the module is importable
    expect(container).toBeTruthy();
  });

  test('renders table mode with column headers present', () => {
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(3)}
            folders={['/folder/afolder']}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // Wait for NTable to render
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = new Promise((r) => setTimeout(r, 10));

    // Table mode should show the thead with Name header
    // We verify structure rather than full render since MutationObserver is not in happy-dom
    const tableHeaders = container.querySelectorAll('th');
    // Verify Name column is present (5 columns)
    const nameHeader = Array.from(tableHeaders).find((h) => h.textContent === 'Name');
    expect(nameHeader).toBeTruthy();
  });

  test('renders cards mode without table element', () => {
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(3)}
            folders={['/folder/afolder']}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // No table in cards mode
    expect(container.querySelector('table')).toBeNull();
  });

  test('mode=table renders with table element present', () => {
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(2)}
            folders={[]}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // In table mode, a table element should be present
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
  });

  test('mode=cards renders FileTile tiles with w-36 class', () => {
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(2)}
            folders={['/folder/myfolder']}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // Cards use w-36 class
    const tiles = container.querySelectorAll('.w-36');
    expect(tiles.length).toBe(3); // 2 files + 1 folder
  });

  test('onNavigate fires when tile content is clicked (mode=cards)', () => {
    const onNavigate = mock();
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(1)}
            folders={[]}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={onNavigate}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // Find tile and click its name span
    const tiles = container.querySelectorAll('.w-36');
    expect(tiles.length).toBe(1);
    const nameSpan = tiles[0].querySelector('span');
    expect(nameSpan).toBeTruthy();

    fireEvent.click(nameSpan!);
    expect(onNavigate).toHaveBeenCalledWith('/folder/file0.txt', false);
  });

  test('onNavigate fires when folder tile is clicked (mode=cards)', () => {
    const onNavigate = mock();
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={[]}
            folders={['/folder/afolder']}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={onNavigate}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const tiles = container.querySelectorAll('.w-36');
    expect(tiles.length).toBe(1);
    const nameSpan = tiles[0].querySelector('span');
    fireEvent.click(nameSpan!);
    expect(onNavigate).toHaveBeenCalledWith('/folder/afolder', true);
  });

  test('mode=cards: tile click does not fire onSelectAll (checkbox click only)', () => {
    const onSelectAll = mock();
    const onNavigate = mock();
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={makeFiles(1)}
            folders={[]}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={onSelectAll}
            onNavigate={onNavigate}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    // Click the tile body (not checkbox)
    const tiles = container.querySelectorAll('.w-36');
    const nameSpan = tiles[0].querySelector('span');
    fireEvent.click(nameSpan!);

    // onSelectAll should NOT have been called for body click
    expect(onSelectAll).not.toHaveBeenCalled();
    // onNavigate should have been called
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('FileBrowser tag chips', () => {
  const makeTaggedFiles = (tagCounts: number[][]): FileItem[] =>
    tagCounts.map((tags, i) => ({
      namespace: 'test',
      filePath: `/file${i}.txt`,
      mimeType: 'text/plain',
      size: 100,
      updatedAt: new Date().toISOString(),
      tags: tags.map((t) => `tag-${t}`),
    }));

  test('table mode renders up to 2 tag chips per row', () => {
    const files = makeTaggedFiles([[1, 2, 3]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const tagButtons = container.querySelectorAll('td button.rounded-md');
    expect(tagButtons.length).toBe(2);
    expect(tagButtons[0].textContent).toBe('tag-1');
    expect(tagButtons[1].textContent).toBe('tag-2');
  });

  test('table mode shows +N overflow when more than 2 tags', () => {
    const files = makeTaggedFiles([[1, 2, 3, 4]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const overflow = container.querySelector('td span.text-\\[10px\\].text-txt-muted');
    expect(overflow).toBeTruthy();
    expect(overflow?.textContent).toBe('+2');
  });

  test('table mode tag chip click fires onTagFilter', () => {
    const onTagFilter = mock();
    const files = makeTaggedFiles([[1]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="table"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
            onTagFilter={onTagFilter}
          />
        </div>
      </StorageStudioProvider>
    );

    const tagBtn = container.querySelector('td button.rounded-md');
    expect(tagBtn).toBeTruthy();
    fireEvent.click(tagBtn!);
    expect(onTagFilter).toHaveBeenCalledWith('tag-1');
  });

  test('cards mode renders tag chips on file tiles', () => {
    const files = makeTaggedFiles([[1, 2]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const cardTagBtns = container.querySelectorAll('.w-36 button.rounded');
    expect(cardTagBtns.length).toBe(2);
    expect(cardTagBtns[0].textContent).toBe('tag-1');
    expect(cardTagBtns[1].textContent).toBe('tag-2');
  });

  test('cards mode shows +N overflow when more than 2 tags', () => {
    const files = makeTaggedFiles([[1, 2, 3]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const overflow = container.querySelector('.w-36 span.text-\\[9px\\].text-txt-muted');
    expect(overflow).toBeTruthy();
    expect(overflow?.textContent).toBe('+1');
  });

  test('cards mode does not render tag chips on folders', () => {
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={[]}
            folders={['/folder']}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={mock()}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
          />
        </div>
      </StorageStudioProvider>
    );

    const tiles = container.querySelectorAll('.w-36');
    expect(tiles.length).toBe(1);
    const cardTagBtns = tiles[0].querySelectorAll('button.rounded');
    expect(cardTagBtns.length).toBe(0);
  });

  test('cards mode tag chip click fires onTagFilter and stops propagation', () => {
    const onTagFilter = mock();
    const onNavigate = mock();
    const files = makeTaggedFiles([[1]]);
    const { container } = render(
      <StorageStudioProvider apiBase="/api/storage-studio" storageApiBase="/api">
        <div style={{ height: 600 }}>
          <FileBrowser
            files={files}
            folders={[]}
            namespace="test"
            mode="cards"
            selected={new Set()}
            onSelectAll={mock()}
            onNavigate={onNavigate}
            onRowContextMenu={mock()}
            onMoveToFolder={mock()}
            onTagFilter={onTagFilter}
          />
        </div>
      </StorageStudioProvider>
    );

    const tagBtn = container.querySelector('.w-36 button.rounded');
    expect(tagBtn).toBeTruthy();
    fireEvent.click(tagBtn!);
    expect(onTagFilter).toHaveBeenCalledWith('tag-1');
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
