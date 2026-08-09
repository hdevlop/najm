import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NNextImage } from "../src/adapters/next";

const img = (container: HTMLElement) => container.querySelector("img")!;

/**
 * The optimizer's URL for a source, as `next/image` writes it into `src`.
 *
 * Matched loosely rather than by prefix: `next/image` re-assigns `img.src` from
 * the element's own property whenever an `onError` handler is present — its
 * workaround for an error that fired before hydration — and that assignment
 * resolves the relative URL against the document.
 */
const optimized = (element: HTMLImageElement) =>
  element.getAttribute("src")!.includes("/_next/image");

describe("NNextImage source recovery", () => {
  test("renders Next's Image, not a bare img", () => {
    const { container } = render(
      <NNextImage src="/cover.png" alt="Cover" width={64} height={64} />,
    );

    // The optimizer rewrites the source; a plain <img> would keep it verbatim.
    expect(optimized(img(container))).toBe(true);
    expect(img(container).getAttribute("src")).toContain("%2Fcover.png");
    expect(img(container).getAttribute("srcset")).toBeTruthy();
  });

  test("switches to fallbackSrc after a failure", () => {
    const { container } = render(
      <NNextImage
        src="/cover.png"
        fallbackSrc="/stock.png"
        alt="Cover"
        width={64}
        height={64}
      />,
    );

    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toContain("%2Fstock.png");
  });

  test("switches once and does not loop when the fallback fails too", () => {
    const { container } = render(
      <NNextImage
        src="/cover.png"
        fallbackSrc="/stock.png"
        alt="Cover"
        width={64}
        height={64}
      />,
    );

    fireEvent.error(img(container));
    fireEvent.error(img(container));
    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toContain("%2Fstock.png");
  });

  test("composes the consumer's onError", () => {
    let calls = 0;
    const { container } = render(
      <NNextImage
        src="/cover.png"
        fallbackSrc="/stock.png"
        alt="Cover"
        width={64}
        height={64}
        onError={() => (calls += 1)}
      />,
    );

    fireEvent.error(img(container));

    expect(calls).toBe(1);
    expect(img(container).getAttribute("src")).toContain("%2Fstock.png");
  });

  test("a new src resets the failure state", () => {
    const { container, rerender } = render(
      <NNextImage
        src="/a.png"
        fallbackSrc="/stock.png"
        alt="Cover"
        width={64}
        height={64}
      />,
    );

    fireEvent.error(img(container));
    expect(img(container).getAttribute("src")).toContain("%2Fstock.png");

    rerender(
      <NNextImage
        src="/b.png"
        fallbackSrc="/stock.png"
        alt="Cover"
        width={64}
        height={64}
      />,
    );

    expect(img(container).getAttribute("src")).toContain("%2Fb.png");
  });
});

describe("NNextImage loading policy", () => {
  test("defaults to lazy", () => {
    const { container } = render(
      <NNextImage src="/cover.png" alt="Cover" width={64} height={64} />,
    );

    expect(img(container).getAttribute("loading")).toBe("lazy");
  });

  test("an explicit loading value wins", () => {
    const { container } = render(
      <NNextImage
        src="/cover.png"
        alt="Cover"
        width={64}
        height={64}
        loading="eager"
      />,
    );

    expect(img(container).getAttribute("loading")).toBe("eager");
  });

  test("priority is left to Next rather than forced lazy", () => {
    const { container } = render(
      <NNextImage src="/cover.png" alt="Cover" width={64} height={64} priority />,
    );

    // Next treats `priority` and an explicit lazy `loading` as contradictory;
    // defaulting over it would make the two props unusable together.
    expect(img(container).getAttribute("loading")).not.toBe("lazy");
  });
});

/** `fill` needs a positioned, sized box, exactly as it does in an application. */
function FillBox({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "relative", height: 64, width: 64 }}>{children}</div>;
}

describe("NNextImage layout contract", () => {
  test("preserves fill and sizes", () => {
    const { container } = render(
      <FillBox>
        <NNextImage src="/cover.png" alt="Cover" fill sizes="64px" />
      </FillBox>,
    );

    const element = img(container);
    expect(element.getAttribute("sizes")).toBe("64px");
    expect(element.getAttribute("style")).toContain("absolute");
  });

  test("preserves explicit dimensions", () => {
    const { container } = render(
      <NNextImage src="/cover.png" alt="Cover" width={48} height={48} />,
    );

    expect(img(container).getAttribute("width")).toBe("48");
    expect(img(container).getAttribute("height")).toBe("48");
  });

  test("unoptimized delivers the source untouched", () => {
    const { container } = render(
      <FillBox>
        <NNextImage
          src="/api/managed/serve/abc"
          alt="Managed asset"
          fill
          sizes="64px"
          unoptimized
        />
      </FillBox>,
    );

    // The whole point for a route the browser must reach directly: no
    // optimizer between the page and the backend.
    expect(img(container).getAttribute("src")).toContain("/api/managed/serve/abc");
    expect(optimized(img(container))).toBe(false);
  });

  test("unoptimized survives the fallback transition", () => {
    const { container } = render(
      <FillBox>
        <NNextImage
          src="/api/managed/serve/abc"
          fallbackSrc="/api/managed/serve/stock"
          alt="Managed asset"
          fill
          unoptimized
        />
      </FillBox>,
    );

    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toContain(
      "/api/managed/serve/stock",
    );
    expect(optimized(img(container))).toBe(false);
  });

  test("forwards class and accessibility props", () => {
    const { container } = render(
      <NNextImage
        src="/cover.png"
        alt="Cover"
        width={64}
        height={64}
        className="object-cover"
        decoding="async"
      />,
    );

    expect(img(container).className).toContain("object-cover");
    expect(img(container).getAttribute("decoding")).toBe("async");
  });
});
