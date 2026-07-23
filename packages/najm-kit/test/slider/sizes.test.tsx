import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider, type SliderSize } from "../../src/components/Slider/Slider";

const TRACK_SIZES: Record<SliderSize, { horizontal: string; vertical: string }> = {
  sm: { horizontal: "h-1", vertical: "w-1" },
  md: { horizontal: "h-1.5", vertical: "w-1.5" },
  lg: { horizontal: "h-2", vertical: "w-2" },
};

const THUMB_SIZES: Record<SliderSize, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
};

describe("NSlider sizes", () => {
  for (const [size, expected] of Object.entries(TRACK_SIZES)) {
    test(`size="${size}" applies ${expected.horizontal} to horizontal track`, () => {
      const { container } = render(<NSlider value={50} size={size as SliderSize} />);
      const track = container.querySelector('[data-slot="slider-track"]');
      expect(track).not.toBeNull();
      expect(track!.classList.toString()).toContain(expected.horizontal);
    });
  }

  for (const [size, expected] of Object.entries(THUMB_SIZES)) {
    test(`size="${size}" applies ${expected} to thumb`, () => {
      const { container } = render(<NSlider value={50} size={size as SliderSize} />);
      const thumb = container.querySelector('[data-slot="slider-thumb"]');
      expect(thumb).not.toBeNull();
      expect(thumb!.classList.toString()).toContain(expected);
    });
  }
});
