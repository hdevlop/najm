import { afterEach, describe, test, expect, mock } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NFileBrowser, type FileNode } from "../../src/components/table/NFileBrowser";

const nodes: FileNode[] = [
  { key: "folder-1", name: "Projects", isFolder: true },
  { key: "file-1", name: "notes.txt", isFolder: false, mimeType: "text/plain", size: 1200 },
];

const originalMatchMedia = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: mock((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: mock(),
      removeEventListener: mock(),
      addListener: mock(),
      removeListener: mock(),
      dispatchEvent: mock(),
    })),
  });
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("file-browser-menu.test.tsx", () => {
  test("cards mode MoreVertical uses the shared row context menu path", async () => {
    mockMatchMedia(false);
    const onContextMenu = mock();

    const { container } = render(
      <div style={{ height: 600 }}>
        <NFileBrowser
          nodes={nodes}
          mode="cards"
          onContextMenu={onContextMenu}
          showCheckbox={false}
          showPagination={false}
        />
      </div>
    );
    await new Promise((r) => setTimeout(r, 100));

    const btn = container.querySelector('button[aria-label="Row actions"]');
    expect(btn).toBeTruthy();

    fireEvent.click(btn!);
    await new Promise((r) => setTimeout(r, 20));

    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onContextMenu.mock.calls[0][1]).toEqual(nodes[0]);
  });
});
