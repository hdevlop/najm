import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";

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

  test("caps its viewport at the host's max-height so a max-h-* host scrolls instead of clipping", async () => {
    const { container } = render(
      <NajmScroll className="max-h-64">
        {Array.from({ length: 50 }, (_, index) => <div key={index}>Option {index}</div>)}
      </NajmScroll>,
    );
    const host = container.firstElementChild as HTMLElement;

    await waitFor(() => {
      expect(host.querySelector("[data-overlayscrollbars-viewport]")).toBeTruthy();
    });
    const viewport = host.querySelector("[data-overlayscrollbars-viewport]") as HTMLElement;

    expect(viewport.parentElement).toBe(host);
    expect(viewport.style.maxHeight).toBe("inherit");
    expect(viewport.style.maxWidth).toBe("inherit");
    expect(viewport.style.overflowY).toBe("auto");
  });

  test("enhances an existing headless-component viewport", async () => {
    const { getByTestId } = render(<ExistingViewportHarness />);

    await waitFor(() => {
      expect(getByTestId("host").querySelector(".os-scrollbar.os-theme-najm")).toBeTruthy();
    });

    expect(getByTestId("viewport").hasAttribute("data-overlayscrollbars-viewport")).toBe(true);
  });

  test("contains popup wheel events so an outer smart scroll cannot consume them", async () => {
    let outerWheelEvents = 0;
    const { getByTestId } = render(
      <div onWheel={() => { outerWheelEvents += 1; }}>
        <ExistingViewportHarness />
      </div>,
    );

    await waitFor(() => {
      expect(getByTestId("host").querySelector(".os-scrollbar.os-theme-najm")).toBeTruthy();
    });
    fireEvent.wheel(getByTestId("viewport"), { deltaY: 120 });

    expect(outerWheelEvents).toBe(0);
  });
});
