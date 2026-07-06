import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NajmDesignProvider } from "../../src/theme/design-provider";
import { NajmThemeProvider } from "../../src/theme/provider";
import { Badge } from "../../src/components/Badge/Badge";
import { Button } from "../../src/components/Button/Button";
import { defineNajmDesignConfig } from "../../src/theme/design-config";

describe("NajmDesignProvider", () => {
  test("applies component radius recipe to Badge", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { badge: { radius: "full" } },
    });
    const { getByText } = render(
      <NajmDesignProvider config={config}>
        <Badge>Hello</Badge>
      </NajmDesignProvider>,
    );
    const el = getByText("Hello");
    expect(el.style.borderRadius).toBe("9999px");
  });

  test("explicit props override design defaults", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { button: { defaultVariant: "secondary" } },
    });
    const { getByRole } = render(
      <NajmDesignProvider config={config}>
        <Button variant="destructive">Go</Button>
      </NajmDesignProvider>,
    );
    expect(getByRole("button").className).toContain("destructive");
  });

  test("NajmThemeProvider works without NajmDesignProvider", () => {
    const { getByText } = render(
      <NajmThemeProvider config={{ mode: "dark" }}>
        <Badge>Bare</Badge>
      </NajmThemeProvider>,
    );
    expect(getByText("Bare")).toBeTruthy();
  });

  test("badge primary variant can reuse secondary recipe class", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { badge: { variants: { primary: { className: "alias-applied" } } } },
    });
    const { getByText } = render(
      <NajmDesignProvider config={config}>
        <Badge variant={"primary" as any}>Aliased</Badge>
      </NajmDesignProvider>,
    );
    expect(getByText("Aliased").className).toContain("alias-applied");
  });

  test("resolves root tokens and active-mode overrides from design config", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {
        mode: "light",
        accent: "emerald",
        tokens: { background: "light-root", primary: "light-primary" },
        overrides: { light: { primary: "light-override" } },
      },
    });
    const { container } = render(
      <NajmDesignProvider config={config}>
        <span>Theme</span>
      </NajmDesignProvider>,
    );

    const theme = container.querySelector("[data-najm-theme]") as HTMLElement;
    expect(theme.style.getPropertyValue("--background")).toBe("light-root");
    expect(theme.style.getPropertyValue("--primary")).toBe("light-override");
  });

  test("mode prop resolves another mode without leaking root tokens", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {
        mode: "light",
        accent: "emerald",
        tokens: { background: "light-root", primary: "light-primary" },
        overrides: { dark: { primary: "dark-override" } },
      },
    });
    const { container } = render(
      <NajmDesignProvider config={config} mode="dark">
        <span>Theme</span>
      </NajmDesignProvider>,
    );

    const theme = container.querySelector("[data-najm-theme]") as HTMLElement;
    expect(theme.getAttribute("data-najm-theme")).toBe("dark-emerald");
    expect(theme.style.getPropertyValue("--background")).not.toBe("light-root");
    expect(theme.style.getPropertyValue("--primary")).toBe("dark-override");
  });
});
