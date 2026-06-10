import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

describe("NSlider ARIA", () => {
  test("thumb has aria-valuemin, aria-valuemax, aria-valuenow", () => {
    const { container } = render(<NSlider value={42} min={0} max={100} />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).not.toBeNull();
    expect(thumb!.getAttribute("aria-valuemin")).toBe("0");
    expect(thumb!.getAttribute("aria-valuemax")).toBe("100");
    expect(thumb!.getAttribute("aria-valuenow")).toBe("42");
  });

  test("aria-label is forwarded when provided", () => {
    const { container } = render(<NSlider value={50} aria-label="Volume" />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).not.toBeNull();
    expect(thumb!.getAttribute("aria-label")).toBe("Volume");
  });

  test("thumb has aria-orientation from Radix", () => {
    const { container } = render(<NSlider value={50} />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).not.toBeNull();
    expect(thumb!.getAttribute("aria-orientation")).toBe("horizontal");
  });
});
