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

describe("FormInput avatar type", () => {
  test("accepts ImageInput sizing and inner-content options", () => {
    const avatarInput = {
      name: "avatar",
      type: "avatar",
      value: null,
      previewClassName: "h-32 w-32",
      size: 128,
      fill: true,
      title: "Add photo",
      subtitle: "JPG or PNG",
      onChange: (_value: File | null) => {},
    } satisfies FormInputProps;

    expect(avatarInput.type).toBe("avatar");
  });
});
