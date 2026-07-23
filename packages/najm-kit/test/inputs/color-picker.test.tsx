import { describe, expect, test } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColorPickerInput } from "../../src/components/inputs/ColorPickerInput";

describe("ColorPickerInput", () => {
  test("defaults to swatch mode and renders preset swatches", () => {
    const { container } = render(
      <ColorPickerInput value="#ff0000" onChange={() => {}} />
    );
    // legacy color input + swatch buttons
    expect(container.querySelector('input[type="color"]')).toBeTruthy();
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  test("hideSwatches removes preset swatches in swatch mode", () => {
    const { container } = render(
      <ColorPickerInput value="#ff0000" onChange={() => {}} hideSwatches />
    );
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  test("popover mode renders a trigger button", () => {
    const { getByText } = render(
      <ColorPickerInput value="#ff0000" onChange={() => {}} mode="popover" />
    );
    expect(getByText("#ff0000")).toBeTruthy();
  });

  test("swatch click emits the color", () => {
    let emitted = "";
    const { container } = render(
      <ColorPickerInput
        value="#ff0000"
        onChange={(c) => (emitted = c)}
        colors={["#00ff00"]}
      />
    );
    const swatch = container.querySelector('button[title="#00ff00"]') as HTMLButtonElement;
    fireEvent.click(swatch);
    expect(emitted).toBe("#00ff00");
  });
});
