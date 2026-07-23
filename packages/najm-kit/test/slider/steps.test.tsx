import { describe, test, expect } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

describe("NSlider steps", () => {
  test("step={5}: ArrowRight increments by 5", () => {
    const spy = (v: number | [number, number]) => {
      spy.lastCall = v;
    };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={40} step={5} onValueChange={spy} />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]')!;
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });

    expect(spy.lastCall).toBe(45);
  });
});
