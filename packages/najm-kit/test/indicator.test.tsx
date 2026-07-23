import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import {
  NIndicator,
  Indicator,
  indicatorVariants,
} from "../src/components/Indicator";
import * as najmUI from "../src/index";

describe("NIndicator", () => {
  test("exports from package root", () => {
    expect(najmUI.NIndicator).toBe(NIndicator);
    expect(najmUI.Indicator).toBe(Indicator);
    expect(najmUI.Indicator).toBe(NIndicator);
    expect(typeof indicatorVariants).toBe("function");
    expect(typeof najmUI.indicatorVariants).toBe("function");
  });

  test("renders default position as top-end", () => {
    const { container } = render(
      <NIndicator>
        <span data-testid="child">x</span>
      </NIndicator>
    );
    const overlay = container.querySelector(
      '[data-slot="indicator-overlay"]'
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute("data-position")).toBe("top-end");
    const cls = overlay!.className;
    expect(cls).toContain("top-0");
    expect(cls).toContain("end-0");
    expect(cls).toContain("translate-x-1/2");
  });

  test("maps position prop to correct utilities", () => {
    const { container } = render(
      <NIndicator position="bottom-center">
        <span>x</span>
      </NIndicator>
    );
    const overlay = container.querySelector(
      '[data-slot="indicator-overlay"]'
    ) as HTMLElement;
    expect(overlay.getAttribute("data-position")).toBe("bottom-center");
    const cls = overlay.className;
    expect(cls).toContain("bottom-0");
    expect(cls).toContain("start-1/2");
    expect(cls).toContain("-translate-x-1/2");
    expect(cls).toContain("translate-y-1/2");
  });

  test("emits literal responsive breakpoint classes", () => {
    const { container } = render(
      <NIndicator
        position={{
          base: "top-end",
          sm: "middle-end",
          md: "bottom-end",
          lg: "top-start",
        }}
      >
        <span>x</span>
      </NIndicator>
    );
    const overlay = container.querySelector(
      '[data-slot="indicator-overlay"]'
    ) as HTMLElement;
    const cls = overlay.className;
    expect(cls).toContain("top-0");
    expect(cls).toContain("end-0");
    expect(cls).toContain("sm:top-1/2");
    expect(cls).toContain("sm:end-0");
    expect(cls).toContain("md:bottom-0");
    expect(cls).toContain("md:end-0");
    expect(cls).toContain("lg:top-0");
    expect(cls).toContain("lg:start-0");
  });

  test("renders dot overlay by default with no badge", () => {
    const { container } = render(
      <NIndicator overlay="dot" color="primary">
        <span>x</span>
      </NIndicator>
    );
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    const sizeWrap = container.querySelector(
      '[data-slot="indicator-overlay"] > span'
    ) as HTMLElement;
    expect(sizeWrap).not.toBeNull();
    const core = sizeWrap.querySelector("span:last-child") as HTMLElement;
    expect(core.className).toContain("bg-pink-500");
  });

  test("status overlay adds a ring", () => {
    const { container } = render(
      <NIndicator overlay="status" color="success">
        <span>x</span>
      </NIndicator>
    );
    const sizeWrap = container.querySelector(
      '[data-slot="indicator-overlay"] > span'
    ) as HTMLElement;
    const core = sizeWrap.querySelector("span:last-child") as HTMLElement;
    expect(core.className).toContain("ring-2");
    expect(core.className).toContain("ring-background");
    expect(core.className).toContain("bg-emerald-500");
  });

  test("badge overlay renders an NBadge with content", () => {
    const { container } = render(
      <NIndicator overlay="badge" content="+99" color="primary">
        <span>x</span>
      </NIndicator>
    );
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("+99");
  });

  test("button overlay renders content as-is", () => {
    const { container } = render(
      <NIndicator
        overlay="button"
        content={<button data-testid="dismiss">×</button>}
      >
        <span>x</span>
      </NIndicator>
    );
    expect(container.querySelector('[data-testid="dismiss"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  test("custom overlay renders content with no chrome", () => {
    const { container } = render(
      <NIndicator
        overlay="custom"
        content={<span data-testid="custom-node">Z</span>}
      >
        <span>x</span>
      </NIndicator>
    );
    expect(
      container.querySelector('[data-testid="custom-node"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  test("color maps to the right background class", () => {
    const cases: Array<[string, string]> = [
      ["primary", "bg-pink-500"],
      ["secondary", "bg-indigo-500"],
      ["accent", "bg-orange-500"],
      ["neutral", "bg-slate-500"],
      ["info", "bg-sky-500"],
      ["success", "bg-emerald-500"],
      ["warning", "bg-amber-400"],
      ["destructive", "bg-red-500"],
    ];
    for (const [color, expected] of cases) {
      const { container } = render(
        <NIndicator overlay="dot" color={color as any}>
          <span>x</span>
        </NIndicator>
      );
      const sizeWrap = container.querySelector(
        '[data-slot="indicator-overlay"] > span'
      ) as HTMLElement;
      const core = sizeWrap.querySelector("span:last-child") as HTMLElement;
      expect(core.className).toContain(expected);
    }
  });

  test("size maps to the right utility on the dot wrapper", () => {
    const sizes: Array<[string, string]> = [
      ["sm", "size-2"],
      ["md", "size-3"],
      ["lg", "size-4"],
    ];
    for (const [size, expected] of sizes) {
      const { container } = render(
        <NIndicator overlay="dot" size={size as any}>
          <span>x</span>
        </NIndicator>
      );
      const dot = container.querySelector(
        '[data-slot="indicator-overlay"] > span'
      ) as HTMLElement;
      expect(dot.className).toContain(expected);
    }
  });

  test("ping renders a hidden animated ring", () => {
    const { container } = render(
      <NIndicator overlay="dot" color="destructive" ping>
        <span>x</span>
      </NIndicator>
    );
    const ping = container.querySelector('[data-slot="indicator-ping"]');
    expect(ping).not.toBeNull();
    expect(ping!.getAttribute("aria-hidden")).toBe("true");
    expect((ping as HTMLElement).className).toContain("animate-ping");
    expect((ping as HTMLElement).className).toContain("bg-red-500");
  });

  test("pulse adds animate-pulse to the badge overlay", () => {
    const { container } = render(
      <NIndicator overlay="badge" content="loading..." color="primary" pulse>
        <span>x</span>
      </NIndicator>
    );
    const badge = container.querySelector('[data-slot="badge"]') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.className).toContain("animate-pulse");
  });

  test("renders children as a sibling of the overlay", () => {
    const { container } = render(
      <NIndicator>
        <span data-testid="child">child-text</span>
      </NIndicator>
    );
    const child = container.querySelector('[data-testid="child"]');
    expect(child).not.toBeNull();
    const root = container.querySelector('[data-slot="indicator"]')!;
    expect(root.contains(child)).toBe(true);
  });
});
