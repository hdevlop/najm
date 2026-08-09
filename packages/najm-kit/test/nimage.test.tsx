import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { NImage } from "../src/components/ui/NImage";

const img = (container: HTMLElement) => container.querySelector("img")!;

describe("NImage", () => {
  test("renders the source and an empty alt by default", () => {
    const { container } = render(<NImage src="/logo.png" />);

    expect(img(container).getAttribute("src")).toBe("/logo.png");
    expect(img(container).getAttribute("alt")).toBe("");
  });

  test("swaps to the fallback once the source fails", () => {
    const { container } = render(
      <NImage src="/logo.png" fallback="/logo-fallback.png" alt="Logo" />,
    );

    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toBe("/logo-fallback.png");
  });

  test("stays on the fallback when it fails too, rather than looping", () => {
    const { container } = render(
      <NImage src="/logo.png" fallback="/logo-fallback.png" />,
    );

    fireEvent.error(img(container));
    fireEvent.error(img(container));
    fireEvent.error(img(container));

    // The last attempt keeps its src: no source is retried, and the element is
    // never handed a source it already knows is dead.
    expect(img(container).getAttribute("src")).toBe("/logo-fallback.png");
  });

  test("keeps the source with no fallback supplied", () => {
    const { container } = render(<NImage src="/logo.png" />);

    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toBe("/logo.png");
  });

  test("preserves the consumer's onError while performing the swap", () => {
    const seen: string[] = [];

    const { container } = render(
      <NImage
        src="/logo.png"
        fallback="/logo-fallback.png"
        onError={(event) => seen.push(event.currentTarget.getAttribute("src")!)}
      />,
    );

    fireEvent.error(img(container));

    expect(seen).toEqual(["/logo.png"]);
    expect(img(container).getAttribute("src")).toBe("/logo-fallback.png");
  });

  test("forwards the consumer's onLoad untouched", () => {
    let loads = 0;
    const { container } = render(
      <NImage src="/logo.png" onLoad={() => (loads += 1)} />,
    );

    fireEvent.load(img(container));

    expect(loads).toBe(1);
  });

  test("a new src discards the previous failure", () => {
    const { container, rerender } = render(
      <NImage src="/a.png" fallback="/fallback.png" />,
    );

    fireEvent.error(img(container));
    expect(img(container).getAttribute("src")).toBe("/fallback.png");

    rerender(<NImage src="/b.png" fallback="/fallback.png" />);

    expect(img(container).getAttribute("src")).toBe("/b.png");
  });

  test("a new fallback discards the previous failure", () => {
    const { container, rerender } = render(
      <NImage src="/a.png" fallback="/one.png" />,
    );

    fireEvent.error(img(container));
    expect(img(container).getAttribute("src")).toBe("/one.png");

    rerender(<NImage src="/a.png" fallback="/two.png" />);

    // The primary is worth one more attempt: nothing about it is known to have
    // failed under the new pair.
    expect(img(container).getAttribute("src")).toBe("/a.png");
  });

  test("does not retry an identical src and fallback", () => {
    const { container } = render(<NImage src="/same.png" fallback="/same.png" />);

    fireEvent.error(img(container));

    expect(img(container).getAttribute("src")).toBe("/same.png");
  });

  test("forwards native image attributes and accessibility props", () => {
    const { container } = render(
      <NImage
        src="/logo.png"
        alt="Logo"
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        width={64}
        height={64}
        className="rounded"
        aria-hidden
      />,
    );

    const element = img(container);
    expect(element.getAttribute("loading")).toBe("lazy");
    expect(element.getAttribute("decoding")).toBe("async");
    expect(element.getAttribute("crossorigin")).toBe("anonymous");
    expect(element.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(element.getAttribute("width")).toBe("64");
    expect(element.getAttribute("height")).toBe("64");
    expect(element.className).toBe("rounded");
    expect(element.getAttribute("aria-hidden")).toBe("true");
  });

  test("invents no layout of its own", () => {
    // The caller's box owns the size; a `fill` prop here would be a second,
    // conflicting layout system on a plain <img>.
    const { container } = render(<NImage src="/logo.png" />);

    expect(img(container).getAttribute("style")).toBeNull();
    expect(img(container).className).toBe("");
  });
});
