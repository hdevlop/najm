import { describe, test, expect } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { NSlider, Slider } from "../../src/index";

describe("NSlider backwards compatibility", () => {
  test("both NSlider and Slider resolve from barrel", () => {
    expect(NSlider).toBeDefined();
    expect(Slider).toBeDefined();
  });

  test("legacy Slider accepts value={[40]} and calls onValueChange with an array", () => {
    const spy = (v: number[]) => {
      spy.lastCall = v;
    };
    spy.lastCall = null as any;

    const { container } = render(<Slider value={[40]} onValueChange={spy} />);
    const thumb = container.querySelector('[data-slot="slider-thumb"]');
    expect(thumb).not.toBeNull();
    fireEvent.focus(thumb!);
    fireEvent.keyDown(thumb!, { key: "ArrowRight" });

    expect(Array.isArray(spy.lastCall)).toBe(true);
    expect(spy.lastCall).toEqual([41]);
  });
});
