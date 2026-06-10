import { describe, test, expect } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

function getThumbs(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="slider-thumb"]');
}

describe("NSlider basic", () => {
  test("single value renders one thumb", () => {
    const { container } = render(<NSlider value={42} />);
    expect(getThumbs(container).length).toBe(1);
  });

  test("tuple value renders two thumbs", () => {
    const { container } = render(<NSlider value={[20, 80]} />);
    expect(getThumbs(container).length).toBe(2);
  });

  test("ArrowRight on focused thumb calls onValueChange with incremented scalar", () => {
    const spy = (v: number | [number, number]) => {
      spy.lastCall = v;
    };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={40} onValueChange={spy} />);
    const thumb = getThumbs(container)[0];
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });

    expect(spy.lastCall).toBe(41);
  });

  test("disabled blocks keyboard interaction", () => {
    const spy = (v: number | [number, number]) => {
      spy.lastCall = v;
    };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={40} onValueChange={spy} disabled />);
    const thumb = getThumbs(container)[0];
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });

    expect(spy.lastCall).toBeNull();
  });
});
