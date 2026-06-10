import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

describe("NSlider RTL", () => {
  test('dir="rtl": root has dir="rtl"', () => {
    const { container } = render(<NSlider value={60} dir="rtl" />);
    const root = container.querySelector('[data-slot="slider"]');
    expect(root).not.toBeNull();
    expect(root!.getAttribute("dir")).toBe("rtl");
  });
});
