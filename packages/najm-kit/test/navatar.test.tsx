import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { NAvatar } from "../src/components/Avatar/Avatar";

const img = (container: HTMLElement) => container.querySelector("img");
const initials = (container: HTMLElement) =>
  container.querySelector("[data-slot=avatar-fallback]");

describe("NAvatar text and initials", () => {
  test("renders fallback text without a text row by default", () => {
    const { container } = render(<NAvatar fallback="API" />);

    expect(container.textContent).toBe("API");
  });

  test("shows the title by default and uses it for initials", () => {
    const { container } = render(<NAvatar title="Jane Doe" />);

    expect(container.textContent).toContain("JD");
    expect(container.textContent).toContain("Jane Doe");
  });

  test("shows subtitle and meta with title", () => {
    const { container } = render(
      <NAvatar title="Jane Doe" subtitle="Admin" meta={<span>2 orders</span>} />,
    );

    expect(container.textContent).toContain("JD");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).toContain("2 orders");
  });

  test("falls back to a question mark with nothing to derive initials from", () => {
    const { container } = render(<NAvatar />);

    expect(container.textContent).toBe("?");
  });
});

describe("NAvatar image lifecycle", () => {
  test("keeps initials mounted while the image is still loading", () => {
    const { container } = render(
      <NAvatar src="https://example.com/fahd.png" title="Fahd Moujahid" />,
    );

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/fahd.png",
    );
    // Both are mounted: the image is absolutely positioned over the initials,
    // so nothing shifts when it paints.
    expect(initials(container)).not.toBeNull();
    expect(img(container)?.className).toContain("absolute");
  });

  test("removes initials once the image loads, transparent pixels included", () => {
    const { container } = render(
      <NAvatar src="https://example.com/transparent.png" title="Fahd Moujahid" />,
    );

    fireEvent.load(img(container)!);

    // A transparent PNG is indistinguishable from an opaque one here on
    // purpose: unmounting is what stops letters showing through the image.
    expect(initials(container)).toBeNull();
    expect(img(container)).not.toBeNull();
  });

  test("brings initials back when the only source fails, with no broken image left behind", () => {
    const { container } = render(
      <NAvatar src="https://example.com/gone.png" title="Fahd Moujahid" />,
    );

    fireEvent.load(img(container)!);
    expect(initials(container)).toBeNull();

    fireEvent.error(img(container)!);

    expect(initials(container)).not.toBeNull();
    expect(container.textContent).toContain("FM");
    // Unmounted rather than left with a dead src, which is the browser's
    // broken-image glyph sitting on top of the initials.
    expect(img(container)).toBeNull();
  });
});

describe("NAvatar fallback chain", () => {
  test("tries fallbackSrc after the primary fails", () => {
    const { container } = render(
      <NAvatar
        src="https://example.com/primary.png"
        fallbackSrc="https://example.com/stock.png"
        title="Fahd Moujahid"
      />,
    );

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/primary.png",
    );

    fireEvent.error(img(container)!);

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/stock.png",
    );
    expect(initials(container)).not.toBeNull();

    fireEvent.load(img(container)!);
    expect(initials(container)).toBeNull();
  });

  test("keeps initials after every source has failed", () => {
    const { container } = render(
      <NAvatar
        src="https://example.com/primary.png"
        fallbackSrc="https://example.com/stock.png"
        title="Fahd Moujahid"
      />,
    );

    fireEvent.error(img(container)!);
    fireEvent.error(img(container)!);

    expect(img(container)).toBeNull();
    expect(container.textContent).toContain("FM");
  });

  test("uses fallbackSrc directly when there is no primary source", () => {
    const { container } = render(
      <NAvatar fallbackSrc="https://example.com/stock.png" title="Fahd" />,
    );

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/stock.png",
    );
  });

  test("skips a seeded placeholder source in favour of the fallback", () => {
    const { container } = render(
      <NAvatar
        src="/uploads/noavatar.png"
        fallbackSrc="https://example.com/stock.png"
        title="Fahd"
      />,
    );

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/stock.png",
    );
  });

  test("does not retry an identical source supplied twice", () => {
    const { container } = render(
      <NAvatar
        src="https://example.com/same.png"
        fallbackSrc="https://example.com/same.png"
        title="Fahd Moujahid"
      />,
    );

    fireEvent.error(img(container)!);

    expect(img(container)).toBeNull();
    expect(container.textContent).toContain("FM");
  });

  test("resets failures when source lists contain delimiter characters", () => {
    const { container, rerender } = render(
      <NAvatar src="a" fallbackSrc={"b\na"} title="Fahd Moujahid" />,
    );

    fireEvent.error(img(container)!);
    expect(img(container)?.getAttribute("src")).toBe("b\na");

    rerender(
      <NAvatar src={"a\nb"} fallbackSrc="a" title="Fahd Moujahid" />,
    );
    fireEvent.error(img(container)!);

    expect(img(container)?.getAttribute("src")).toBe("a");
  });
});

describe("NAvatar cache versions", () => {
  test("stamps the version onto both the primary and the fallback", () => {
    const { container } = render(
      <NAvatar
        src="https://example.com/primary.png"
        fallbackSrc="https://example.com/stock.png?w=64"
        version={7}
        title="Fahd"
      />,
    );

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/primary.png?v=7",
    );

    fireEvent.error(img(container)!);

    expect(img(container)?.getAttribute("src")).toBe(
      "https://example.com/stock.png?w=64&v=7",
    );
  });

  test("srcVersion wins over version", () => {
    const { container } = render(
      <NAvatar src="/a.png" version={1} srcVersion={2} title="Fahd" />,
    );

    expect(img(container)?.getAttribute("src")).toBe("/a.png?v=2");
  });

  test("leaves data and blob sources unstamped", () => {
    const { container: data } = render(
      <NAvatar src="data:image/png;base64,AAAA" version={7} title="Fahd" />,
    );
    expect(img(data)?.getAttribute("src")).toBe("data:image/png;base64,AAAA");

    const { container: blob } = render(
      <NAvatar src="blob:http://localhost/abc" version={7} title="Fahd" />,
    );
    expect(img(blob)?.getAttribute("src")).toBe("blob:http://localhost/abc");
  });

  test("a new version discards the previous failure", () => {
    const { container, rerender } = render(
      <NAvatar src="/a.png" version={1} title="Fahd Moujahid" />,
    );

    fireEvent.error(img(container)!);
    expect(img(container)).toBeNull();

    rerender(<NAvatar src="/a.png" version={2} title="Fahd Moujahid" />);

    expect(img(container)?.getAttribute("src")).toBe("/a.png?v=2");
  });

  test("a new src discards the previous failure and its loaded state", () => {
    const { container, rerender } = render(
      <NAvatar src="/a.png" title="Fahd Moujahid" />,
    );

    fireEvent.load(img(container)!);
    expect(initials(container)).toBeNull();

    rerender(<NAvatar src="/b.png" title="Fahd Moujahid" />);

    expect(img(container)?.getAttribute("src")).toBe("/b.png");
    expect(initials(container)).not.toBeNull();
  });
});

describe("NAvatar imageProps", () => {
  test("defaults to lazy loading", () => {
    const { container } = render(<NAvatar src="/a.png" title="Fahd" />);

    expect(img(container)?.getAttribute("loading")).toBe("lazy");
  });

  test("an explicit loading value wins over the lazy default", () => {
    const { container } = render(
      <NAvatar src="/a.png" title="Fahd" imageProps={{ loading: "eager" }} />,
    );

    expect(img(container)?.getAttribute("loading")).toBe("eager");
  });

  test("forwards native attributes", () => {
    const { container } = render(
      <NAvatar
        src="/a.png"
        title="Fahd"
        imageProps={{
          sizes: "64px",
          decoding: "async",
          referrerPolicy: "no-referrer",
        }}
      />,
    );

    const element = img(container)!;
    expect(element.getAttribute("sizes")).toBe("64px");
    expect(element.getAttribute("decoding")).toBe("async");
    expect(element.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  test("runs consumer handlers exactly once alongside the internal state", () => {
    const loads: string[] = [];
    const errors: string[] = [];

    const { container } = render(
      <NAvatar
        src="/primary.png"
        fallbackSrc="/stock.png"
        title="Fahd Moujahid"
        imageProps={{
          onLoad: (event) => loads.push(event.currentTarget.getAttribute("src")!),
          onError: (event) => errors.push(event.currentTarget.getAttribute("src")!),
        }}
      />,
    );

    fireEvent.error(img(container)!);
    fireEvent.load(img(container)!);

    expect(errors).toEqual(["/primary.png"]);
    expect(loads).toEqual(["/stock.png"]);
    // The consumer's handlers did not replace the chain: it still advanced and
    // still took the initials down.
    expect(img(container)?.getAttribute("src")).toBe("/stock.png");
    expect(initials(container)).toBeNull();
  });
});

describe("NAvatar presentation", () => {
  test("keeps the class slots", () => {
    const { container } = render(
      <NAvatar
        src="/a.png"
        title="Fahd"
        subtitle="Admin"
        meta="meta"
        className="outer"
        classNames={{
          root: "root-slot",
          avatar: "avatar-slot",
          image: "image-slot",
          fallback: "fallback-slot",
          title: "title-slot",
          subtitle: "subtitle-slot",
          meta: "meta-slot",
        }}
      />,
    );

    expect(container.firstElementChild?.className).toContain("root-slot");
    expect(container.firstElementChild?.className).toContain("outer");
    expect(container.querySelector("[data-slot=avatar]")?.className).toContain(
      "avatar-slot",
    );
    expect(img(container)?.className).toContain("image-slot");
    expect(initials(container)?.className).toContain("fallback-slot");
    expect(container.innerHTML).toContain("title-slot");
    expect(container.innerHTML).toContain("subtitle-slot");
    expect(container.innerHTML).toContain("meta-slot");
  });

  test("shape and size reach the avatar box", () => {
    const { container: square } = render(
      <NAvatar fallback="SQ" shape="square" size="xl" />,
    );
    const box = square.querySelector("[data-slot=avatar]")!;
    expect(box.className).toContain("rounded-none");
    expect(box.className).toContain("w-16");
  });

  test("alt falls back to the label", () => {
    const { container: labelled } = render(
      <NAvatar src="/a.png" title="Fahd Moujahid" />,
    );
    expect(img(labelled)?.getAttribute("alt")).toBe("Fahd Moujahid");

    const { container: explicit } = render(
      <NAvatar src="/a.png" title="Fahd Moujahid" alt="Profile photo" />,
    );
    expect(img(explicit)?.getAttribute("alt")).toBe("Profile photo");

    // Nothing to name it with stays decorative rather than inventing text.
    const { container: bare } = render(<NAvatar src="/a.png" />);
    expect(bare.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});
