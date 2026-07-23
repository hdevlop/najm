import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NAvatar } from "../src/components/Avatar/Avatar";

describe("NAvatar", () => {
  test("renders fallback text without a text row by default", () => {
    const { container } = render(<NAvatar fallback="API" />);

    expect(container.textContent).toBe("API");
  });

  test("shows the title by default and uses it for initials", () => {
    const { container } = render(<NAvatar title="Jane Doe" />);

    expect(container.textContent).toContain("JD");
    expect(container.textContent).toContain("Jane Doe");
  });

  test("shows subtitle with title", () => {
    const { container } = render(<NAvatar title="Jane Doe" subtitle="Admin" />);

    expect(container.textContent).toContain("JD");
    expect(container.textContent).toContain("Jane Doe");
    expect(container.textContent).toContain("Admin");
  });

  test("hides initials after the avatar image loads", () => {
    const { container } = render(
      <NAvatar src="https://example.com/fahd.png" title="Fahd Moujahid" />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/fahd.png",
    );
    expect(container.querySelector("[data-slot=avatar-fallback]")).toBeNull();
  });
});
