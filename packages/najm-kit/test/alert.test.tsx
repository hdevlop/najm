import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import {
  Alert,
  NAlert,
  alertVariants,
} from "../src/components/Alert";
import {
  Alert as LegacyAlert,
  NAlert as LegacyNAlert,
} from "../src/components/ui/alert";

describe("Alert", () => {
  test("keeps legacy ui/alert path aligned", () => {
    expect(LegacyAlert).toBe(Alert);
    expect(LegacyNAlert).toBe(NAlert);
    expect(NAlert).toBe(Alert);
  });

  test("renders with title and description props", () => {
    const { container } = render(
      <Alert tone="info" title="Title" description="Desc" />
    );
    expect(container.textContent).toContain("Title");
    expect(container.textContent).toContain("Desc");
    expect(container.querySelector("[role='alert']")).toBeTruthy();
  });

  test("renders tone variants via tone prop", () => {
    const { container } = render(<Alert tone="success" description="ok" />);
    const el = container.querySelector("[role='alert']")!;
    expect(el.className).toContain("border-emerald");
  });

  test("tone prop wins over variant prop", () => {
    const { container: c1 } = render(
      <Alert tone="info" variant="error" description="x" />
    );
    const { container: c2 } = render(
      <Alert variant="error" description="x" />
    );
    expect(c1.querySelector("[role='alert']")!.className).toContain("sky");
    expect(c2.querySelector("[role='alert']")!.className).toContain("red");
  });

  test("renders size variants", () => {
    const { container: sm } = render(<Alert size="sm" description="x" />);
    const { container: lg } = render(<Alert size="lg" description="x" />);
    expect(sm.querySelector("[role='alert']")!.className).toContain("text-xs");
    expect(lg.querySelector("[role='alert']")!.className).toContain("text-base");
  });

  test("renders look variants", () => {
    const { container: outline } = render(<Alert look="outline" description="x" />);
    const { container: solid } = render(<Alert look="solid" description="x" />);
    expect(outline.querySelector("[role='alert']")!.className).toContain("bg-transparent");
    expect(solid.querySelector("[role='alert']")!.className).toContain("border-transparent");
  });

  test("renders actions slot", () => {
    const { container } = render(
      <Alert description="x" actions={<button data-testid="act">Go</button>} />
    );
    expect(container.querySelector("[data-testid='act']")).toBeTruthy();
  });

  test("renders children when no shortcut props", () => {
    const { container } = render(<Alert><span>Manual body</span></Alert>);
    expect(container.textContent).toContain("Manual body");
  });

  test("renders a default SVG icon for each tone", () => {
    const tones = ["default", "info", "success", "warning", "destructive", "error"] as const;
    for (const tone of tones) {
      const { container } = render(<Alert tone={tone} description="x" />);
      expect(container.querySelector("svg"), `missing icon for tone=${tone}`).toBeTruthy();
    }
  });

  test("accepts lucide string icon name", () => {
    const { container } = render(<Alert tone="info" icon="megaphone" description="x" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("accepts component ref icon", () => {
    const { container } = render(<Alert tone="info" icon={AlertCircle} description="x" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("accepts rendered element icon", () => {
    const { container } = render(
      <Alert tone="info" icon={<AlertCircle data-testid="custom" />} description="x" />
    );
    expect(container.querySelector("[data-testid='custom']")).toBeTruthy();
  });

  test("hides icon when icon={false}", () => {
    const { container } = render(<Alert tone="info" icon={false} description="x" />);
    expect(container.querySelector("svg")).toBeFalsy();
  });

  test("no icon when no shortcut props", () => {
    const { container } = render(<Alert>children</Alert>);
    expect(container.querySelector("svg")).toBeFalsy();
  });

  test("alertVariants function works", () => {
    const cls = alertVariants({ tone: "info", look: "solid" });
    expect(cls).toContain("bg-sky-500");
  });
});

describe("Alert barrel export", () => {
  test("new folder barrel re-exports match direct imports", () => {
    const barrel = require("../src/components/Alert");
    expect(barrel.Alert).toBe(Alert);
    expect(barrel.NAlert).toBe(NAlert);
    expect(typeof barrel.alertVariants).toBe("function");
  });

  test("legacy ui/alert barrel re-exports match direct imports", () => {
    const legacy = require("../src/components/ui/alert");
    expect(legacy.Alert).toBe(Alert);
    expect(legacy.NAlert).toBe(NAlert);
    expect(typeof legacy.alertVariants).toBe("function");
  });
});
