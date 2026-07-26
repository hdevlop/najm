import { describe, test, expect, beforeEach } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import {
  NajmThemeProvider,
  NajmThemeContainerCtx,
} from "../../src/theme/provider";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../../src/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../src/components/ui/dropdown-menu";

function getRootInlineVars(): Record<string, string> {
  const out: Record<string, string> = {};
  const inline = (document.documentElement as any).style;
  for (let i = 0; i < inline.length; i++) {
    const k = inline.item(i);
    if (k && k.startsWith("--")) out[k] = inline.getPropertyValue(k);
  }
  return out;
}

describe("NajmThemeProvider â€” opt-in theming", () => {
  beforeEach(() => {
    (document.documentElement as any).removeAttribute("style");
  });

  test("no props: renders children, injects NO inline style on :root, no inline vars on documentElement", () => {
    const beforeVars = getRootInlineVars();

    const { container } = render(
      <NajmThemeProvider>
        <span data-testid="child">hi</span>
      </NajmThemeProvider>
    );

    const host = container.querySelector("[data-najm-theme]") as HTMLElement | null;
    expect(host).toBeTruthy();
    expect(host!.getAttribute("style") ?? "").toBe("");
    expect(container.textContent).toContain("hi");

    const afterVars = getRootInlineVars();
    expect(afterVars).toEqual(beforeVars);
    expect(afterVars["--background"]).toBeUndefined();
    expect(afterVars["--primary"]).toBeUndefined();
  });

  test("explicit mode=light: injects scoped token style on wrapper, no leakage to documentElement", () => {
    render(
      <NajmThemeProvider mode="light" accent="neutral">
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    expect(host).toBeTruthy();
    const style = host.getAttribute("style") ?? "";
    expect(style).toContain("--background");
    expect(style).toContain("--primary");

    expect((document.documentElement as any).style.getPropertyValue("--background")).toBe("");
    expect((document.documentElement as any).style.getPropertyValue("--primary")).toBe("");
  });

  test("explicit tokens={...}: injects the supplied unprefixed --* vars on wrapper, not on :root", () => {
    const tokens = {
      background: "oklch(0.5 0.1 200)",
      primary: "oklch(0.6 0.2 100)",
    };
    render(
      <NajmThemeProvider tokens={tokens}>
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    const style = host.getAttribute("style") ?? "";
    expect(style).toContain("--background: oklch(0.5 0.1 200)");
    expect(style).toContain("--primary: oklch(0.6 0.2 100)");
    expect(style).not.toContain("--najm-");

    expect((document.documentElement as any).style.getPropertyValue("--background")).toBe("");
  });

  test("radius always applies one uniform scale without requiring theme tokens", () => {
    render(
      <NajmThemeProvider radius="0.75rem">
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    const style = host.getAttribute("style") ?? "";
    expect(style).toContain("--radius: 0.75rem");
    expect(style).toContain("--radius-md: var(--radius)");
    expect(style).toContain("--radius-lg: var(--radius)");
    expect(style).toContain("--radius-xl: var(--radius)");
  });

  test("applies and updates one JSON-friendly config object", () => {
    const { rerender } = render(
      <NajmThemeProvider
        config={{
          mode: "dark",
          accent: "blue",
          radius: "0.5rem",
          tokens: { primary: "oklch(0.6 0.2 250)" },
        }}
      >
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    expect((host as any).style.getPropertyValue("--primary")).toBe("oklch(0.6 0.2 250)");
    expect((host as any).style.getPropertyValue("--radius")).toBe("0.5rem");

    rerender(
      <NajmThemeProvider
        config={{
          mode: "light",
          accent: "emerald",
          radius: "1rem",
          tokens: { primary: "oklch(0.7 0.18 155)" },
        }}
      >
        <span>x</span>
      </NajmThemeProvider>
    );

    expect((host as any).style.getPropertyValue("--primary")).toBe("oklch(0.7 0.18 155)");
    expect((host as any).style.getPropertyValue("--radius")).toBe("1rem");
  });

  test("explicit props override JSON config values", () => {
    render(
      <NajmThemeProvider
        config={{ radius: "1rem" }}
        radius="0.25rem"
      >
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    const inline = (host as any).style;
    expect(inline.getPropertyValue("--radius")).toBe("0.25rem");
    expect(inline.getPropertyValue("--radius-md")).toBe("var(--radius)");
  });

  test("accentOnly: only the accent token keys are emitted on the wrapper", () => {
    render(
      <NajmThemeProvider
        mode="light"
        accent="emerald"
        accentOnly
        tokens={{ background: "oklch(0.1 0 0)", primary: "oklch(0.7 0.2 160)", "primary-foreground": "oklch(1 0 0)", ring: "oklch(0.7 0.2 160)", accent: "oklch(0.4 0.1 160)", "accent-foreground": "oklch(0.9 0.05 160)", "sidebar-primary": "oklch(0.7 0.2 160)", "sidebar-ring": "oklch(0.7 0.2 160)" }}
      >
        <span>x</span>
      </NajmThemeProvider>
    );

    const host = document.querySelector("[data-najm-theme]") as HTMLElement;
    const style = host.getAttribute("style") ?? "";
    expect(style).toContain("--primary");
    expect(style).toContain("--primary-foreground");
    expect(style).toContain("--ring");
    expect(style).toContain("--accent");
    expect(style).toContain("--accent-foreground");
    expect(style).toContain("--sidebar-primary");
    expect(style).toContain("--sidebar-ring");
    expect(style).not.toContain("--background");
  });

  test("host token preservation: a host --primary on :root is untouched on mount and after unmount with mode=dark", () => {
    (document.documentElement as any).style.setProperty("--primary", "oklch(0.99 0.1 50)");
    const before = (document.documentElement as any).style.getPropertyValue("--primary");

    const { unmount } = render(
      <NajmThemeProvider mode="dark" accent="violet">
        <span>x</span>
      </NajmThemeProvider>
    );

    const afterMount = (document.documentElement as any).style.getPropertyValue("--primary");
    expect(afterMount).toBe(before);

    unmount();

    const afterUnmount = (document.documentElement as any).style.getPropertyValue("--primary");
    expect(afterUnmount).toBe(before);
  });

  test("portal scoping: Select renders content into the themed container (NajmThemeContainerCtx)", () => {
    let observed: HTMLElement | null = null;

    function Probe() {
      const ctx = React.useContext(NajmThemeContainerCtx);
      React.useEffect(() => {
        observed = ctx;
      }, [ctx]);
      return null;
    }

    const ref = React.createRef<HTMLButtonElement>();

    const { getByText } = render(
      <NajmThemeProvider mode="dark" accent="emerald">
        <Probe />
        <Select defaultOpen>
          <SelectTrigger ref={ref}>
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Apple</SelectItem>
            <SelectItem value="b">Banana</SelectItem>
          </SelectContent>
        </Select>
      </NajmThemeProvider>
    );

    expect(observed).toBeTruthy();
    const themed = observed!;
    expect(themed.hasAttribute("data-najm-theme")).toBe(true);

    const selectContent = themed.querySelector('[data-slot="select-content"]');
    expect(selectContent).toBeTruthy();

    const items = themed.querySelectorAll('[data-slot="select-item"]');
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain("Apple");
    expect(items[1]?.textContent).toContain("Banana");

    const outsideThemed = document.body.querySelector('[data-slot="select-content"]');
    const strayOutsideThemed = outsideThemed && !themed.contains(outsideThemed);
    expect(strayOutsideThemed).toBeFalsy();
  });

  test("nested providers: inner provider overrides only within its subtree, does not bleed to siblings", () => {
    const { container } = render(
      <NajmThemeProvider mode="light" tokens={{ background: "oklch(0.1 0 0)" }}>
        <span data-testid="outer">A</span>
        <NajmThemeProvider mode="dark" tokens={{ background: "oklch(0.9 0 0)" }}>
          <span data-testid="inner">B</span>
        </NajmThemeProvider>
      </NajmThemeProvider>
    );

    const providers = Array.from(container.querySelectorAll("[data-najm-theme]")) as HTMLElement[];
    expect(providers.length).toBe(2);

    const outer = providers[0];
    const inner = providers[1];
    expect(outer.getAttribute("style") ?? "").toContain("--background: oklch(0.1 0 0)");
    expect(inner.getAttribute("style") ?? "").toContain("--background: oklch(0.9 0 0)");
  });

  test("no document.documentElement mirror: provider never touches document.documentElement.style", () => {
    const setPropertySpy = (() => {
      let called = false;
      const orig = (document.documentElement as any).style.setProperty;
      (document.documentElement as any).style.setProperty = function (...args: any[]) {
        called = true;
        return orig.apply(this, args as any);
      };
      return () => called;
    })();

    const { unmount } = render(
      <NajmThemeProvider mode="dark" accent="green">
        <span>x</span>
      </NajmThemeProvider>
    );
    expect(setPropertySpy()).toBe(false);
    unmount();
    expect(setPropertySpy()).toBe(false);
  });
});
