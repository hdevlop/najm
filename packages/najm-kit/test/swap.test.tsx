import { describe, test, expect } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { Swap } from "../src/components/Swap/Swap";

describe("Swap", () => {
  test("renders off content by default", () => {
    const { container } = render(<Swap on="ON" off="OFF" />);
    expect(container.textContent).toContain("OFF");
    expect(container.textContent).toContain("ON");
  });

  test("starts in off state", () => {
    const { container } = render(<Swap on="ON" off="OFF" />);
    const button = container.querySelector("button")!;
    expect(button.getAttribute("data-state")).toBe("off");
  });

  test("uncontrolled click toggles on/off", () => {
    const { container } = render(<Swap on="ON" off="OFF" />);
    const button = container.querySelector("button")!;

    fireEvent.click(button);
    expect(button.getAttribute("data-state")).toBe("on");

    fireEvent.click(button);
    expect(button.getAttribute("data-state")).toBe("off");
  });

  test("controlled checked calls onCheckedChange with the next checked state", () => {
    const calls: boolean[] = [];
    const { container, rerender } = render(
      <Swap checked={false} onCheckedChange={(v) => calls.push(v)} on="ON" off="OFF" />
    );
    const button = container.querySelector("button")!;

    fireEvent.click(button);
    expect(calls).toEqual([true]);

    rerender(<Swap checked={true} onCheckedChange={(v) => calls.push(v)} on="ON" off="OFF" />);
    fireEvent.click(button);
    expect(calls).toEqual([true, false]);
  });

  test("controlled checked reflects state", () => {
    const { container } = render(<Swap checked={true} on="ON" off="OFF" />);
    const button = container.querySelector("button")!;
    expect(button.getAttribute("data-state")).toBe("on");
  });

  test("state=indeterminate renders indeterminate content", () => {
    const { container } = render(
      <Swap state="indeterminate" on="On" off="Off" indeterminate="Mixed" />
    );
    const button = container.querySelector("button")!;
    expect(button.getAttribute("data-state")).toBe("indeterminate");
    expect(button.getAttribute("aria-pressed")).toBe("mixed");
    expect(container.textContent).toContain("Mixed");
  });

  test("effect=rotate applies rotate class variant", () => {
    const { container } = render(<Swap on="ON" off="OFF" effect="rotate" />);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("rotate-180");
  });

  test("effect=flip applies flip class variant", () => {
    const { container } = render(<Swap on="ON" off="OFF" effect="flip" />);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("rotateY");
  });

  test("disabled prevents toggling", () => {
    const { container } = render(<Swap on="ON" off="OFF" disabled />);
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(button.getAttribute("data-state")).toBe("off");
  });

  test("onClick composes with internal toggling", () => {
    let clicked = false;
    const { container } = render(<Swap on="ON" off="OFF" onClick={() => { clicked = true; }} />);
    const button = container.querySelector("button")!;

    fireEvent.click(button);
    expect(clicked).toBe(true);
    expect(button.getAttribute("data-state")).toBe("on");
  });

  test("aria-pressed reflects boolean state", () => {
    const { container } = render(<Swap checked={true} on="ON" off="OFF" />);
    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  test("role is switch", () => {
    const { container } = render(<Swap on="ON" off="OFF" />);
    const button = container.querySelector("button")!;
    expect(button.getAttribute("role")).toBe("switch");
  });

  test("size applies expected classes", () => {
    const { container: sm } = render(<Swap on="ON" off="OFF" size="sm" />);
    expect(sm.querySelector("button")!.className).toContain("h-7");

    const { container: lg } = render(<Swap on="ON" off="OFF" size="lg" />);
    expect(lg.querySelector("button")!.className).toContain("h-11");
  });
});
