import { describe, expect, test } from "bun:test";
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Camera } from "lucide-react";
import { AvatarInput } from "../src/components/inputs/AvatarInput";
import { AvatarFormInput } from "../src/components/form/AvatarFormInput";
import { NForm } from "../src/components/form/NForm";

describe("AvatarInput", () => {
  test("uses circular ImageInput defaults", () => {
    const { container } = render(<AvatarInput value={null} onChange={() => {}} />);
    const preview = container.querySelector("[data-image-input-state]");

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
    const preview = container.querySelector("[data-image-input-state]");

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

    expect(container.querySelector("[data-image-input-state]")?.className).toContain("rounded-none");

    rerender(
      <AvatarInput value={null} onChange={() => {}} radius="xl" />,
    );

    expect(container.querySelector("[data-image-input-state]")?.className).toContain("rounded-xl");

    rerender(
      <AvatarInput value={null} onChange={() => {}} radius="full" />,
    );

    expect(container.querySelector("[data-image-input-state]")?.className).toContain("rounded-full");
  });

  test("accepts an exact pixel size", () => {
    const { container } = render(
      <AvatarInput value={null} onChange={() => {}} size={118} />,
    );
    const preview = container.querySelector<HTMLElement>("[data-image-input-state]");

    expect(preview?.style.width).toBe("118px");
    expect(preview?.style.height).toBe("118px");
  });

  test("fills the available width and height", () => {
    const { container } = render(
      <AvatarInput value={null} onChange={() => {}} fill />,
    );
    const root = container.firstElementChild;
    const preview = container.querySelector("[data-image-input-state]");

    expect(root?.className).toContain("flex-1");
    expect(root?.className).toContain("w-full");
    expect(preview?.className).toContain("size-full");
  });

  test("stretches its form item when fill is enabled", () => {
    const { container } = render(
      <NForm defaultValues={{ avatar: null }} onSubmit={() => {}}>
        <AvatarFormInput name="avatar" fill />
      </NForm>,
    );

    const item = container.querySelector('[data-slot="form-item"]');
    expect(item?.className).toContain("h-full");
    expect(item?.className).toContain("w-full");
  });

  test("forwards previewAlt, fallbackImage, and unavailableContent props", () => {
    const { container } = render(
      <AvatarInput
        value="https://broken.example.com/missing.png"
        onChange={() => {}}
        previewAlt="Avatar preview"
        fallbackImage="https://cdn.example.com/default.png"
        unavailableContent={<span data-testid="fallback-text">Avatar unavailable</span>}
        onPreviewError={() => {}}
      />,
    );

    const preview = container.querySelector("[data-image-input-state]");
    expect(preview).not.toBeNull();

    let img = container.querySelector("img");
    fireEvent.error(img!);
    img = container.querySelector("img");
    fireEvent.error(img!);

    expect(container.textContent).toContain("Avatar unavailable");
    expect(container.querySelector('[data-testid="fallback-text"]')).not.toBeNull();
  });
});