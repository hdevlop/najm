import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Name" }];

describe("NTable headerSlot", () => {
  /*
   * The header row wraps below `lg`, but a `shrink-0` slot is as wide as its
   * content: a stats bar or a row of badges wider than a phone ran off the
   * screen instead of wrapping. The slot is capped at the row and wraps its
   * own children.
   */
  test("the slot is capped at the header's width and wraps its content", () => {
    const { container } = render(
      <NTable<Row>
        data={[{ id: "1", name: "Amina" }]}
        columns={columns}
        filters={[{ type: "text", name: "name", placeholder: "Search" }]}
        headerSlot={<span data-test-slot>Stats</span>}
        dynamicHeight={false}
        showPagination={false}
      />,
    );

    const wrapper = container.querySelector("[data-test-slot]")!.parentElement as HTMLElement;
    expect(wrapper.className).toContain("max-w-full");
    expect(wrapper.className).toContain("min-w-0");
    expect(wrapper.className).toContain("flex-wrap");
  });
});
