import { describe, expect, test, jest } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { ColorPickerInput } from "../../src/components/inputs/ColorPickerInput";
import { NajmThemeProvider } from "../../src/theme/provider";

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

  test("popover resolves scoped CSS variable values without replacing the reference", () => {
    const { container, getByText } = render(
      <NajmThemeProvider tokens={{ primary: "#123456" }}>
        <ColorPickerInput
          value="var(--primary)"
          onChange={() => {}}
          mode="popover"
        />
      </NajmThemeProvider>,
    );

    const trigger = container.querySelector("button") as HTMLButtonElement;
    const swatch = trigger.querySelector("span") as HTMLSpanElement;
    expect(swatch.style.backgroundColor).toBe("var(--primary)");
    expect(getByText("var(--primary)")).toBeTruthy();

    fireEvent.click(trigger);
    const colorControl = document.body.querySelector(
      '[aria-label="Color"]',
    ) as HTMLDivElement;
    expect(colorControl.getAttribute("aria-valuetext")).not.toBe(
      "Saturation 0%, Brightness 0%",
    );
  });

  test("popover preset click emits the preserved color from portal content", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ColorPickerInput value="oklch(0.6 0.2 100)" onChange={onChange} mode="popover" />
    );
    const trigger = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(trigger);
    const swatch = document.body.querySelector(
      'button[title="#3B82F6"]',
    ) as HTMLButtonElement;
    expect(swatch).toBeTruthy();
    fireEvent.click(swatch);
    expect(onChange).toHaveBeenCalledWith("#3B82F6");
  });

  test("popover invalid draft does not emit", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ColorPickerInput value="#ff0000" onChange={onChange} mode="popover" />
    );
    fireEvent.click(container.querySelector("button") as HTMLButtonElement);
    const input = document.body.querySelector(
      '[data-slot="popover-content"] input[type="text"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: "not-a-color" } });
    expect(input.value).toBe("not-a-color");
    expect(onChange).not.toHaveBeenCalled();
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
