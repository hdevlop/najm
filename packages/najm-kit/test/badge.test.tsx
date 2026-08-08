import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import {
  Badge,
  NBadge,
  badgeColorVariants,
  badgeVariants,
  resolveStatusColor,
  statusTextClass,
} from "../src/components/Badge";
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
    expect(badgeColorVariants({ color: "success", look: "soft" })).toContain("bg-success/10");
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

    expect(container.textContent).toContain("Active");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("colors a status from the built-in vocabulary without a statusMap", () => {
    const { container } = render(<NBadge status="out-for-delivery" look="soft" />);

    expect(container.textContent).toContain("Out For Delivery");
    expect(container.querySelector("[data-slot=badge]")?.className).toContain("bg-warning/10");
  });

  test("falls back to neutral for an unknown status", () => {
    const { container } = render(<NBadge status="nebulous" look="soft" />);

    expect(container.querySelector("[data-slot=badge]")?.className).toContain("bg-neutral/10");
  });

  test("lets a consumer statusMap override single keys", () => {
    expect(resolveStatusColor("paused", { paused: "destructive" })).toBe("destructive");
    expect(resolveStatusColor("active", { paused: "destructive" })).toBe("success");
    expect(resolveStatusColor("PENDING ")).toBe("warning");
    expect(resolveStatusColor("nebulous", undefined, "info")).toBe("info");
  });

  test("statusTextClass leaves unmapped text in the surrounding color", () => {
    expect(statusTextClass("validated")).toBe("text-success");
    expect(statusTextClass("refunded")).toBe("text-destructive");
    expect(statusTextClass("nebulous")).toBe("");
    expect(statusTextClass("nebulous", undefined, "neutral")).toBe("text-muted-foreground");
  });
});
