import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

describe("NSlider orientation", () => {
  test("horizontal: root has data-orientation='horizontal'", () => {
    const { container } = render(<NSlider value={50} />);
    const root = container.querySelector('[data-slot="slider"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute("data-orientation")).toBe("horizontal");
  });

  test("vertical: root has data-orientation='vertical'", () => {
    const { container } = render(<NSlider value={50} orientation="vertical" />);
    const root = container.querySelector('[data-slot="slider"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute("data-orientation")).toBe("vertical");
  });

  test("vertical: thumb has aria-orientation='vertical'", () => {
    const { container } = render(<NSlider value={50} orientation="vertical" />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).not.toBeNull();
    expect(thumb!.getAttribute("aria-orientation")).toBe("vertical");
  });
});
