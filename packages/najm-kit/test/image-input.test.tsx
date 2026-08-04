import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ImageInput } from "../src/components/inputs/ImageInput";

const noop = () => {};
const FALLBACK_FAIL = "http://localhost/fallback-fail.png";

beforeEach(() => {
  (globalThis as any).__najmResetImageMock?.();
});
afterEach(() => {
  (globalThis as any).__najmResetImageMock?.();
});

describe("ImageInput preview state", () => {
  test("renders a string URL with the consumer alt text", () => {
    const { container } = render(
      <ImageInput value="/a.png" onChange={noop} previewAlt="Avatar" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("Avatar");
    expect(img!.getAttribute("src")).toBe("/a.png");
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("preview");
  });

  test("falls back to fallbackImage when the primary URL errors", () => {
    const { container } = render(
      <ImageInput
        value="/primary.png"
        onChange={noop}
        fallbackImage="/fallback.png"
        previewAlt="Preview"
        fallbackAlt="Fallback"
      />,
    );

    const primaryImg = container.querySelector("img");
    expect(primaryImg?.getAttribute("src")).toBe("/primary.png");
    fireEvent.error(primaryImg!);

    const fallbackImg = container.querySelector("img");
    expect(fallbackImg?.getAttribute("src")).toBe("/fallback.png");
    expect(fallbackImg?.getAttribute("alt")).toBe("Fallback");
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("fallback");
  });

  test("renders unavailableContent after every candidate fails", () => {
    const { container } = render(
      <ImageInput
        value="/primary.png"
        onChange={noop}
        fallbackImage="/fallback.png"
        unavailableContent={<span data-testid="unavailable">Custom unavailable</span>}
      />,
    );

    let img = container.querySelector("img");
    fireEvent.error(img!);
    img = container.querySelector("img");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-unavailable]")).not.toBeNull();
    expect(container.querySelector('[data-testid="unavailable"]')).not.toBeNull();
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");
  });

  test("renders the neutral unavailable state when unavailableContent is omitted", () => {
    const { container } = render(
      <ImageInput
        value="/primary.png"
        onChange={noop}
        fallbackImage="/fallback.png"
      />,
    );

    let img = container.querySelector("img");
    fireEvent.error(img!);
    img = container.querySelector("img");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("Image unavailable");
  });

  test("deduplicates identical primary and fallback URLs", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value="/same.png"
        onChange={noop}
        fallbackImage="/same.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    const img = container.querySelector("img");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-unavailable]")).not.toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe("value");
  });

  test("fires onPreviewError once for each failing candidate", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value="/primary.png"
        onChange={noop}
        fallbackImage="/fallback.png"
        defaultImage="/default.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    let img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/primary.png");
    fireEvent.error(img!);

    img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/fallback.png");
    fireEvent.error(img!);

    img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/default.png");
    fireEvent.error(img!);

    expect(errors.map((e) => e.source)).toEqual(["value", "fallback", "default"]);
    expect(errors.map((e) => e.src)).toEqual(["/primary.png", "/fallback.png", "/default.png"]);
  });

  test("resets failure state when value changes to a new URL", () => {
    const { container, rerender } = render(
      <ImageInput value="/primary.png" onChange={noop} fallbackImage="/fallback.png" />,
    );

    let img = container.querySelector("img");
    fireEvent.error(img!);
    img = container.querySelector("img");
    fireEvent.error(img!);
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");

    rerender(<ImageInput value="/new.png" onChange={noop} fallbackImage="/fallback.png" />);

    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("preview");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/new.png");
  });

  test("resets failure state when imageVersion changes", () => {
    const { container, rerender } = render(
      <ImageInput value="/img.png" onChange={noop} fallbackImage="/fb.png" imageVersion={1} />,
    );

    let img = container.querySelector("img");
    fireEvent.error(img!);
    img = container.querySelector("img");
    fireEvent.error(img!);
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");

    rerender(
      <ImageInput value="/img.png" onChange={noop} fallbackImage="/fb.png" imageVersion={2} />,
    );

    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("preview");
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/img.png?v=2");
  });
});

describe("ImageInput file selection", () => {
  test("renders a local preview and calls onChange with the selected File", () => {
    let received: File | null | undefined;
    function Controlled() {
      const [value, setValue] = useState<File | null>(null);
      return (
        <ImageInput
          value={value}
          previewAlt="Preview"
          onChange={(file) => {
            received = file;
            setValue(file);
          }}
        />
      );
    }
    const { container } = render(<Controlled />);

    const file = new File(["hello"], "avatar.png", { type: "image/png" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    expect(received).toBe(file);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")?.startsWith("data:image/png;base64,")).toBe(true);
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("preview");
  });

  test("stale FileReader completions cannot replace a newer value", async () => {
    function Harness() {
      const [value, setValue] = useState<File | null>(null);
      return (
        <>
          <ImageInput value={value} onChange={setValue} previewAlt="Preview" />
          <button
            type="button"
            onClick={() => setValue(new File(["second"], "second.png", { type: "image/png" }))}
          >
            swap
          </button>
        </>
      );
    }
    const { container } = render(<Harness />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      value: [new File(["first"], "first.png", { type: "image/png" })],
    });
    fireEvent.change(input);
    fireEvent.click(container.querySelector("button")!);

    await new Promise((r) => setTimeout(r, 50));

    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(1);
    const src = imgs[0].getAttribute("src");
    expect(src?.startsWith("data:image/png;base64,")).toBe(true);
    expect(src).not.toContain("first");
  });

  test("clear resets the preview and calls onChange(null)", () => {
    let received: File | null | undefined;
    const { container } = render(
      <ImageInput
        value="https://example.com/preview.png"
        onChange={(file) => {
          received = file;
        }}
        clearAriaLabel="Remove avatar"
      />,
    );

    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Remove avatar"]');
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn!);

    expect(received).toBeNull();
  });

  test("allowClear={false} suppresses the clear control", () => {
    const { container } = render(
      <ImageInput
        value="https://example.com/preview.png"
        onChange={noop}
        allowClear={false}
      />,
    );
    expect(container.querySelector('button[aria-label="Remove image"]')).toBeNull();
  });

  test("disabled state suppresses picker and clear interactions", () => {
    const picker = mock(() => {});
    const { container } = render(
      <ImageInput
        value="https://example.com/preview.png"
        onChange={noop}
        disabled
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.disabled).toBe(true);
    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Remove image"]')!;
    fireEvent.click(clearBtn);
    expect(clearBtn.disabled).toBe(true);
    expect(picker).not.toHaveBeenCalled();
  });

  test("keyboard activation opens the picker exactly once", () => {
    const clickSpy = mock(() => {});
    const { container } = render(
      <ImageInput value="https://example.com/p.png" onChange={noop} />,
    );
    const replaceBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Replace image"]')!;
    expect(replaceBtn).not.toBeNull();
    replaceBtn.addEventListener("click", clickSpy, { once: true });
    replaceBtn.click();
    fireEvent.keyDown(replaceBtn, { key: "Enter" });
    fireEvent.keyDown(replaceBtn, { key: " " });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

describe("ImageInput imageVersion URL handling", () => {
  test("appends ?v= to a relative URL", () => {
    const { container } = render(
      <ImageInput value="/img.png" onChange={noop} imageVersion={3} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/img.png?v=3");
  });

  test("appends &v= to a URL that already has a query string", () => {
    const { container } = render(
      <ImageInput value="/img.png?w=200" onChange={noop} imageVersion={4} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/img.png?w=200&v=4");
  });

  test("preserves fragments after the version", () => {
    const { container } = render(
      <ImageInput value="/img.png#hero" onChange={noop} imageVersion={5} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/img.png?v=5#hero");
  });

  test("does not append to data URLs", () => {
    const { container } = render(
      <ImageInput value="data:image/png;base64,abc" onChange={noop} imageVersion={6} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,abc");
  });

  test("does not append to blob URLs", () => {
    const { container } = render(
      <ImageInput value="blob:http://localhost/abc" onChange={noop} imageVersion={6} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:http://localhost/abc");
  });

  test("falls back to defaultImage when value is null", () => {
    const { container } = render(
      <ImageInput value={null} onChange={noop} defaultImage="/d.png" />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/d.png");
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("fallback");
  });

  test("applies imageVersion to defaultImage as well", () => {
    const { container } = render(
      <ImageInput value={null} onChange={noop} defaultImage="/d.png" imageVersion={9} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/d.png?v=9");
  });

  test("failing defaultImage renders the unavailable state (value is null)", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value={null}
        onChange={noop}
        defaultImage="/missing.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/missing.png");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");
    expect(container.querySelector("[data-image-input-unavailable]")).not.toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].source).toBe("default");
    expect(errors[0].src).toBe("/missing.png");
  });

  test("precedence is value -> fallback -> default when all three are present", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value="/primary.png"
        onChange={noop}
        fallbackImage="/fallback.png"
        defaultImage="/default.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    let img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/primary.png");
    fireEvent.error(img!);

    img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/fallback.png");
    fireEvent.error(img!);

    img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/default.png");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");
    expect(errors.map((e) => e.source)).toEqual(["value", "fallback", "default"]);
    expect(errors.map((e) => e.src)).toEqual([
      "/primary.png",
      "/fallback.png",
      "/default.png",
    ]);
  });

  test("only defaultImage is tracked when value is null (fallbackImage ignored)", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value={null}
        onChange={noop}
        fallbackImage="/fb.png"
        defaultImage="/d.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/d.png");
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("fallback");
    fireEvent.error(img!);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("unavailable");
    expect(errors.map((e) => e.source)).toEqual(["default"]);
    expect(errors.map((e) => e.src)).toEqual(["/d.png"]);
  });

  test("empty value with no defaultImage stays empty", () => {
    const errors: Array<{ source: string; src: string }> = [];
    const { container } = render(
      <ImageInput
        value={null}
        onChange={noop}
        fallbackImage="/fb.png"
        onPreviewError={(err) => errors.push(err)}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-image-input-state]")?.getAttribute("data-image-input-state")).toBe("empty");
    expect(errors).toHaveLength(0);
  });
});

describe("ImageInput accessibility and positioning", () => {
  test("applies logical end-* positioning to the clear control", () => {
    const { container } = render(
      <ImageInput
        value="https://example.com/p.png"
        onChange={noop}
      />,
    );
    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Remove image"]');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn!.className).toMatch(/end-2/);
    expect(clearBtn!.className).not.toMatch(/right-2/);
  });

  test("uses consumer-supplied replaceAriaLabel and clearAriaLabel", () => {
    const { container } = render(
      <ImageInput
        value="https://example.com/p.png"
        onChange={noop}
        replaceAriaLabel="Replace profile photo"
        clearAriaLabel="Delete profile photo"
      />,
    );
    expect(container.querySelector('button[aria-label="Replace profile photo"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Delete profile photo"]')).not.toBeNull();
  });

  test("clear control and compact overlay carry the static nimage-input-* class", () => {
    const { container } = render(
      <ImageInput
        value="https://example.com/p.png"
        onChange={noop}
      />,
    );
    const clearBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Remove image"]')!;
    const replaceBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Replace image"]')!;
    expect(clearBtn.className).toContain("nimage-input-control");
    expect(replaceBtn.className).not.toContain("[@media");
    expect(replaceBtn.className).toContain("nimage-input-compact-overlay");
  });

  test("(hover: hover) and (pointer: fine) rule is compiled into dist/theme.css", () => {
    const cssPath = resolve(import.meta.dir, "..", "dist", "theme.css");
    const css = readFileSync(cssPath, "utf-8");

    expect(css).toContain(".nimage-input-control");
    expect(css).toContain(".nimage-input-compact-overlay");

    const controlMatch = css.match(
      /\.nimage-input-control\s*\{\s*opacity:\s*1;?\s*\}/,
    );
    expect(controlMatch).not.toBeNull();

    const finePointerBlock = css.match(
      /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.nimage-input-control\s*\{\s*opacity:\s*0;?\s*\}[\s\S]*?\}/,
    );
    expect(finePointerBlock).not.toBeNull();

    const focusRestore = css.match(
      /\.nimage-input-control:focus-visible\s*\{\s*opacity:\s*1;?\s*\}/,
    );
    expect(focusRestore).not.toBeNull();
  });
});

describe("ImageInput layout variants", () => {
  test("showPreview={false} renders only the file input", () => {
    const { container } = render(
      <ImageInput value={null} onChange={noop} showPreview={false} />,
    );
    expect(container.querySelector("[data-image-input-state]")).toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  test("previewPosition='left' arranges preview before the input", () => {
    const { container } = render(
      <ImageInput value={null} onChange={noop} previewPosition="left" />,
    );
    expect(container.firstElementChild?.className).toContain("flex");
    expect(container.firstElementChild?.className).toContain("items-center");
    expect(container.firstElementChild?.className).not.toContain("flex-row-reverse");
  });

  test("previewPosition='right' uses flex-row-reverse for RTL symmetry", () => {
    const { container } = render(
      <ImageInput value={null} onChange={noop} previewPosition="right" />,
    );
    expect(container.firstElementChild?.className).toContain("flex-row-reverse");
  });

  test("imageClassName controls presentation classes", () => {
    const { container } = render(
      <ImageInput value="/a.png" onChange={noop} imageClassName="object-contain" />,
    );
    expect(container.querySelector("img")?.className).toContain("object-contain");
  });

  test("contentClassName applies to dropzone overlay and empty state", () => {
    const { container } = render(
      <ImageInput
        value="/a.png"
        onChange={noop}
        previewClassName="w-full h-40"
        contentClassName="bg-black/70"
      />,
    );
    const overlay = container.querySelector("[data-image-input-state] > button");
    expect(overlay?.className).toContain("bg-black/70");
  });
});