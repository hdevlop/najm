import { describe, test, expect } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { NSlider } from "../../src/components/Slider/Slider";

function getThumb(container: HTMLElement) {
  return container.querySelector('[data-slot="slider-thumb"]')!;
}

describe("NSlider keyboard", () => {
  test("ArrowRight increments by step", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} step={1} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(spy.lastCall).toBe(51);
  });

  test("ArrowUp increments by step", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} step={1} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowUp" });
    expect(spy.lastCall).toBe(51);
  });

  test("ArrowLeft decrements by step", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} step={1} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(spy.lastCall).toBe(49);
  });

  test("ArrowDown decrements by step", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} step={1} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowDown" });
    expect(spy.lastCall).toBe(49);
  });

  test("Home jumps to min", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} min={0} max={100} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(spy.lastCall).toBe(0);
  });

  test("End jumps to max", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} min={0} max={100} onValueChange={spy} />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "End" });
    expect(spy.lastCall).toBe(100);
  });

  test("disabled ignores all keys", () => {
    const spy = (v: number | [number, number]) => { spy.lastCall = v; };
    spy.lastCall = null as any;

    const { container } = render(<NSlider value={50} onValueChange={spy} disabled />);
    const thumb = getThumb(container);
    fireEvent.focus(thumb);
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    fireEvent.keyDown(thumb, { key: "Home" });
    fireEvent.keyDown(thumb, { key: "End" });
    expect(spy.lastCall).toBeNull();
  });
});
