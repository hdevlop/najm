import { describe, test, expect, mock } from 'bun:test';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { FileBrowser } from '../src/features/explorer/components/FileBrowser';
import type { FileItem } from '../src/features/explorer/types';

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
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(1)}
          folders={folders}
          mode="table"
          selected={new Set()}
          onSelectAll={onSelectAll}
          onNavigate={onNavigate}
          onRowContextMenu={onRowContextMenu}
          onMoveToFolder={onMoveToFolder}
        />
      </div>
    );
    // If we get here without throwing, the module is importable
    expect(container).toBeTruthy();
  });

  test('renders table mode with column headers present', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(3)}
          folders={['/folder/afolder']}
          mode="table"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={mock()}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
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
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(3)}
          folders={['/folder/afolder']}
          mode="cards"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={mock()}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
    );

    // No table in cards mode
    expect(container.querySelector('table')).toBeNull();
  });

  test('mode=table renders with table element present', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(2)}
          folders={[]}
          mode="table"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={mock()}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
    );

    // In table mode, a table element should be present
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
  });

  test('mode=cards renders FileTile tiles with w-36 class', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(2)}
          folders={['/folder/myfolder']}
          mode="cards"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={mock()}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
    );

    // Cards use w-36 class
    const tiles = container.querySelectorAll('.w-36');
    expect(tiles.length).toBe(3); // 2 files + 1 folder
  });

  test('onNavigate fires when tile content is clicked (mode=cards)', () => {
    const onNavigate = mock();
    const { container } = render(
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(1)}
          folders={[]}
          mode="cards"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={onNavigate}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
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
      <div style={{ height: 600 }}>
        <FileBrowser
          files={[]}
          folders={['/folder/afolder']}
          mode="cards"
          selected={new Set()}
          onSelectAll={mock()}
          onNavigate={onNavigate}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
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
      <div style={{ height: 600 }}>
        <FileBrowser
          files={makeFiles(1)}
          folders={[]}
          mode="cards"
          selected={new Set()}
          onSelectAll={onSelectAll}
          onNavigate={onNavigate}
          onRowContextMenu={mock()}
          onMoveToFolder={mock()}
        />
      </div>
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