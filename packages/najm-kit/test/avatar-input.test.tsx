import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Camera } from "lucide-react";
import { AvatarInput } from "../src/components/inputs/AvatarInput";

describe("AvatarInput", () => {
  test("uses circular ImageInput defaults", () => {
    const { container } = render(<AvatarInput value={null} onChange={() => {}} />);
    const preview = container.querySelector(".group");

    expect(preview?.className).toContain("size-24");
    expect(preview?.className).toContain("rounded-full");
    expect(container.textContent).toContain("Upload photo");
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  test("supports custom dimensions, icon, and inner text", () => {
    const { container } = render(
      <AvatarInput
        value={null}
        onChange={() => {}}
        previewClassName="h-36 w-40"
        uploadIcon={<Camera data-testid="avatar-camera" />}
        title="Choose avatar"
        subtitle="PNG only"
      />,
    );
    const preview = container.querySelector(".group");

    expect(preview?.className).toContain("h-36");
    expect(preview?.className).toContain("w-40");
    expect(container.querySelector('[data-testid="avatar-camera"]')).not.toBeNull();
    expect(container.textContent).toContain("Choose avatar");
    expect(container.textContent).toContain("PNG only");
  });

  test("supports square, rounded, and circular radii", () => {
    const { container, rerender } = render(
      <AvatarInput value={null} onChange={() => {}} radius="none" />,
    );

    expect(container.querySelector(".group")?.className).toContain("rounded-none");

    rerender(
      <AvatarInput value={null} onChange={() => {}} radius="xl" />,
    );

    expect(container.querySelector(".group")?.className).toContain("rounded-xl");

    rerender(
      <AvatarInput value={null} onChange={() => {}} radius="full" />,
    );

    expect(container.querySelector(".group")?.className).toContain("rounded-full");
  });

  test("accepts an exact pixel size", () => {
    const { container } = render(
      <AvatarInput value={null} onChange={() => {}} size={118} />,
    );
    const preview = container.querySelector<HTMLElement>(".group");

    expect(preview?.style.width).toBe("118px");
    expect(preview?.style.height).toBe("118px");
  });
});
