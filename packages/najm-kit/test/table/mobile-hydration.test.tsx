import { afterEach, describe, expect, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";

import { NTable } from "../../src/components/table/NTable";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, any>[] = [{ accessorKey: "name", header: "Name" }];

function Card() {
  return <div data-test-card>Card</div>;
}

function setViewport(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile && query.includes("max-width"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = "";
});

describe("NTable mobile hydration", () => {
  /*
   * The server cannot see the viewport, so it renders the table layout. A phone
   * used to read `matchMedia` in its first render and hydrate the card layout
   * instead, which React reports as a hydration mismatch and repairs by
   * re-rendering the whole tree on the client.
   */
  test("a phone hydrates the server's table layout, then switches to cards", async () => {
    const element = (
      <NTable<Row>
        data={[{ id: "1", name: "Amina" }]}
        columns={columns}
        renderCard={Card as any}
        defaultMode="table"
        dynamicHeight={false}
        showPagination={false}
        showCheckbox={false}
      />
    );

    setViewport(false);
    const html = renderToString(element);

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    setViewport(true);
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, element, { onRecoverableError: (error) => recoverable.push(error) });
    });

    expect(recoverable).toEqual([]);
    expect(container.querySelector("[data-test-card]")).toBeTruthy();
  });
});
