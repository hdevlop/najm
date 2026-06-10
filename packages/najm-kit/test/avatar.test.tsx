import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
} from "../src/components/ui/avatar";

describe("Avatar", () => {
  test("renders fallback text via shortcut API", () => {
    const { container } = render(<Avatar fallback="CN" />);
    expect(container.textContent).toContain("CN");
  });

  test("renders image and fallback via shortcut API", () => {
    const { container } = render(
      <Avatar src="https://example.com/img.png" alt="User" fallback="CN" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/img.png");
    expect(container.textContent).toContain("CN");
  });

  test("compound API still works with AvatarImage and AvatarFallback", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/img.png" alt="User" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(container.textContent).toContain("CN");
  });

  test("size changes class output", () => {
    const { container: xs } = render(<Avatar size="xs" fallback="XS" />);
    expect(xs.querySelector("[data-slot=avatar]")!.className).toContain("size-6");

    const { container: xl } = render(<Avatar size="xl" fallback="XL" />);
    expect(xl.querySelector("[data-slot=avatar]")!.className).toContain("size-16");
  });

  test("shape changes class output", () => {
    const { container: circle } = render(<Avatar shape="circle" fallback="C" />);
    expect(circle.querySelector("[data-slot=avatar]")!.className).toContain("rounded-full");

    const { container: square } = render(<Avatar shape="square" fallback="S" />);
    expect(square.querySelector("[data-slot=avatar]")!.className).toContain("rounded-none");

    const { container: rounded } = render(<Avatar shape="rounded" fallback="R" />);
    expect(rounded.querySelector("[data-slot=avatar]")!.className).toContain("rounded-lg");
  });

  test("status renders a status indicator", () => {
    const { container } = render(<Avatar fallback="ON" status="online" />);
    const status = container.querySelector("[data-slot=avatar-status]");
    expect(status).not.toBeNull();
    expect(status!.className).toContain("bg-emerald-500");
  });

  test("ring adds ring classes", () => {
    const { container } = render(<Avatar fallback="R" ring />);
    expect(container.querySelector("[data-slot=avatar]")!.className).toContain("ring-2");
  });

  test("AvatarGroup renders children and group classes", () => {
    const { container } = render(
      <AvatarGroup>
        <Avatar fallback="A" />
        <Avatar fallback="B" />
      </AvatarGroup>
    );
    const group = container.querySelector("[data-slot=avatar-group]");
    expect(group).not.toBeNull();
    expect(group!.className).toContain("-space-x-2");
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
  });

  test("AvatarGroup with ring propagates ring to Avatar children", () => {
    const { container } = render(
      <AvatarGroup ring>
        <Avatar fallback="A" />
        <Avatar fallback="B" />
      </AvatarGroup>
    );
    const avatars = container.querySelectorAll("[data-slot=avatar]");
    expect(avatars.length).toBe(2);
    avatars.forEach((el) => {
      expect(el.className).toContain("ring-2");
    });
  });

  test("all four statuses render different colors", () => {
    const statuses = ["online", "offline", "busy", "away"] as const;
    const colors = ["bg-emerald-500", "bg-slate-400", "bg-red-500", "bg-amber-400"];

    statuses.forEach((status, i) => {
      const { container } = render(<Avatar fallback="T" status={status} />);
      const dot = container.querySelector("[data-slot=avatar-status]");
      expect(dot!.className).toContain(colors[i]);
    });
  });
});
