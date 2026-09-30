import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import { NDataCardShell } from "../../src/components/table/NDataCardShell";
import { NTableDefaultsProvider } from "../../src/components/table/TableDefaults";

const row = {
  id: "1",
  original: { id: "1" },
  getCanExpand: () => false,
  getIsExpanded: () => false,
  getIsSelected: () => false,
  toggleSelected: () => {},
} as any;

describe("NDataCardShell row-action labels", () => {
  test("renders outside an NTable, where there is no table store", () => {
    const { container } = render(
      <NDataCardShell row={row} showCheckbox={false} menuButton openRowMenu={() => {}}>
        card
      </NDataCardShell>
    );
    expect(container.querySelector('button[aria-label="Row actions"]')).toBeTruthy();
  });

  test("uses the provider's label outside an NTable", () => {
    const { container } = render(
      <NTableDefaultsProvider value={{ toolbarLabels: { rowActions: "إجراءات الصف" } }}>
        <NDataCardShell row={row} showCheckbox={false} menuButton openRowMenu={() => {}}>
          card
        </NDataCardShell>
      </NTableDefaultsProvider>
    );
    expect(container.querySelector('button[aria-label="إجراءات الصف"]')).toBeTruthy();
  });
});
