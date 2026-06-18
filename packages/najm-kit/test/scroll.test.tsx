import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";

import { NajmScroll } from "../src/components/ui/scroll";

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
});
