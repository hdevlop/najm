import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NumberInput, parseNumberInputValue } from "../../src/components/inputs/NumberInput";

describe("NumberInput", () => {
  test("an edit reports the typed number", () => {
    expect(parseNumberInputValue("2323")).toBe(2323);
    expect(parseNumberInputValue("0")).toBe(0);
    expect(parseNumberInputValue("12.5")).toBe(12.5);
  });

  test("a cleared field reports undefined instead of 0", () => {
    expect(parseNumberInputValue("")).toBeUndefined();
  });

  test("an undefined value renders an empty field", () => {
    const { container } = render(<NumberInput value={undefined} onChange={() => {}} />);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("");
  });
});
