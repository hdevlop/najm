import { describe, expect, test } from "bun:test";
import type { FormInputProps } from "../../src/components/form";

describe("FormInput image type", () => {
  test("accepts an optional controlled value and onChange", () => {
    const controlledImageInput = {
      name: "image",
      type: "image",
      value: null,
      onChange: (_value: File | null) => {},
    } satisfies FormInputProps;

    expect(controlledImageInput.type).toBe("image");
  });

  test("accepts a File value", () => {
    const file = new File(["data"], "avatar.png", { type: "image/png" });
    const controlledImageInput = {
      name: "image",
      type: "image",
      value: file,
      onChange: (_value: File | null) => {},
    } satisfies FormInputProps;

    expect(controlledImageInput.value).toBe(file);
  });
});
