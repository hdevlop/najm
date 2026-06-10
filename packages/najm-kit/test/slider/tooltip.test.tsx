import { describe, test, expect } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

function getThumbs(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="slider-thumb"]');
}

describe("NSlider tooltip", () => {
  test("default: no tooltip in DOM", () => {
    const { container } = render(<NSlider value={42} />);
    const tooltip = container.querySelector('[data-slot="slider-tooltip"]');
    expect(tooltip).toBeNull();
  });

  test("showTooltip + focus shows tooltip with formatted value", () => {
    const { container } = render(<NSlider value={42} showTooltip />);
    const thumb = getThumbs(container)[0];
    fireEvent.focus(thumb);

    const tooltip = container.querySelector('[data-slot="slider-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe("42");
  });

  test("blur removes tooltip", () => {
    const { container } = render(<NSlider value={42} showTooltip />);
    const thumb = getThumbs(container)[0];
    fireEvent.focus(thumb);
    expect(container.querySelector('[data-slot="slider-tooltip"]')).not.toBeNull();

    fireEvent.blur(thumb);
    expect(container.querySelector('[data-slot="slider-tooltip"]')).toBeNull();
  });

  test("custom formatTooltip is used", () => {
    const { container } = render(
      <NSlider value={42} showTooltip formatTooltip={(n) => `$${n}`} />
    );
    const thumb = getThumbs(container)[0];
    fireEvent.focus(thumb);

    const tooltip = container.querySelector('[data-slot="slider-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe("$42");
  });
});
