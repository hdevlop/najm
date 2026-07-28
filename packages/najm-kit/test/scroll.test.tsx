import { describe, expect, test } from "bun:test";
import React from "react";
import { render, waitFor } from "@testing-library/react";

import { NajmScroll, useNajmScrollViewport } from "../src/components/ui/scroll";

function ExistingViewportHarness() {
  const { hostRef, viewportRef } = useNajmScrollViewport<HTMLDivElement>();

  return (
    <div ref={hostRef} data-testid="host" className="max-h-20 overflow-hidden">
      <div ref={viewportRef} data-testid="viewport" className="max-h-20">
        {Array.from({ length: 20 }, (_, index) => <div key={index}>Item {index}</div>)}
      </div>
    </div>
  );
}

describe("NajmScroll", () => {
  test("does not make the host a flex container before deferred initialization", () => {
    const { container } = render(
      <NajmScroll>
        <div>content</div>
      </NajmScroll>,
    );

    const host = container.firstElementChild as HTMLElement | null;

    expect(host).toBeTruthy();
    expect(host?.style.display).toBe("");
    expect(host?.style.overflow).toBe("hidden");
    expect(host?.querySelector("[data-overlayscrollbars-contents]")).toBeTruthy();
  });

  test("enhances an existing headless-component viewport", async () => {
    const { getByTestId } = render(<ExistingViewportHarness />);

    await waitFor(() => {
      expect(getByTestId("host").querySelector(".os-scrollbar.os-theme-najm")).toBeTruthy();
    });

    expect(getByTestId("viewport").hasAttribute("data-overlayscrollbars-viewport")).toBe(true);
  });
});
