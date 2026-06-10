import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NProgress, Progress } from "../src/components/Progress";
import { Progress as LegacyProgress } from "../src/components/ui/progress";

describe("Progress", () => {
  test("keeps Progress aliases and legacy path aligned", () => {
    expect(NProgress).toBe(Progress);
    expect(LegacyProgress).toBe(Progress);
  });

  test("outside-right shows the percentage without an explicit label", () => {
    const { container } = render(<Progress value={60} labelPosition="outside-right" />);

    expect(container.textContent).toContain("60%");
  });

  test("outside-right hides percentage for small sizes", () => {
    const { container } = render(<Progress value={60} size="sm" labelPosition="outside-right" />);

    expect(container.textContent).not.toContain("60%");
  });

  test("indeterminate renders a partial animated segment", () => {
    const { container } = render(<Progress indeterminate />);
    const segment = container.querySelector('[data-slot="progress-indeterminate"]');

    expect(segment).toBeTruthy();
    expect(segment?.className).toContain("w-2/5");
    expect(segment?.className).toContain("animate-indeterminate-progress");
  });
});
