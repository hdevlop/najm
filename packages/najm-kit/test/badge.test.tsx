import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { Badge, NBadge, badgeColorVariants, badgeVariants } from "../src/components/Badge";
import { Badge as LegacyBadge } from "../src/components/ui/badge";
import { NBadge as LegacyNBadge } from "../src/components/ui/NBadge";

describe("Badge", () => {
  test("keeps legacy UI badge paths aligned", () => {
    expect(LegacyBadge).toBe(Badge);
    expect(LegacyNBadge).toBe(NBadge);
    expect(NBadge).toBe(Badge);
  });

  test("exports variant helpers", () => {
    expect(typeof badgeVariants).toBe("function");
    expect(typeof badgeColorVariants).toBe("function");
    expect(badgeColorVariants({ color: "success", look: "soft" })).toContain("emerald");
  });

  test("renders primitive badge with string icon", () => {
    const { container } = render(
      <Badge color="success" look="soft" icon="circle-check">
        Active
      </Badge>
    );

    expect(container.textContent).toContain("Active");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("renders NBadge with string icon", () => {
    const { container } = render(
      <NBadge color="info" look="soft" showIcon icon="info" label="Processing" />
    );

    expect(container.textContent).toContain("Processing");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("resolves icons from iconMap by status color", () => {
    const { container } = render(
      <NBadge
        status="active"
        statusMap={{ active: "success" }}
        showIcon
        iconMap={{ success: "circle-check" }}
      />
    );

    expect(container.textContent).toContain("active");
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
