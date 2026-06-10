import { describe, test, expect } from "bun:test";
import { render } from "@testing-library/react";
import { NSlider, type SliderVariant } from "../../src/components/Slider/Slider";

const RANGE_COLORS: Record<SliderVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

describe("NSlider variants", () => {
  for (const [variant, expectedClass] of Object.entries(RANGE_COLORS)) {
    test(`variant="${variant}" applies ${expectedClass} to range`, () => {
      const { container } = render(<NSlider value={50} variant={variant as SliderVariant} />);
      const range = container.querySelector('[data-slot="slider-range"]');
      expect(range).not.toBeNull();
      expect(range!.classList.toString()).toContain(expectedClass);
    });
  }
});
