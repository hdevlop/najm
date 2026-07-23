import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "@testing-library/react";
import { NajmDesignProvider } from "../../src/theme/design-provider";
import { NajmThemeProvider } from "../../src/theme/provider";
import { Badge } from "../../src/components/Badge/Badge";
import { Button } from "../../src/components/Button/Button";
import { IconButton } from "../../src/components/ui/icon-button";
import { BaseInput } from "../../src/components/inputs/BaseInput";
import { defineNajmDesignConfig } from "../../src/theme/design-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../src/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../src/components/ui/dropdown-menu";

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

  test("applies the button radius recipe to regular and icon buttons", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { button: { radius: "7px" } },
    });
    const { getAllByRole } = render(
      <NajmDesignProvider config={config}>
        <Button>Save</Button>
        <IconButton aria-label="Close">×</IconButton>
      </NajmDesignProvider>,
    );

    for (const button of getAllByRole("button")) {
      expect(button.style.borderRadius).toBe("7px");
    }
  });

  test("applies the input radius recipe to BaseInput", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { input: { radius: "9px" } },
    });
    const { getByTestId } = render(
      <NajmDesignProvider config={config}>
        <BaseInput data-testid="input-surface">Value</BaseInput>
        <BaseInput data-testid="rounded-input-surface" variant="rounded">Value</BaseInput>
      </NajmDesignProvider>,
    );

    expect(getByTestId("input-surface").style.borderRadius).toBe("9px");
    expect(getByTestId("rounded-input-surface").style.borderRadius).toBe("");
    expect(getByTestId("rounded-input-surface").className).toContain("rounded-full");
  });

  test("applies the select border recipe to the dropdown surface", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { select: { borderWidth: "2px" } },
    });
    const { container } = render(
      <NajmDesignProvider config={config}>
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Pick" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Apple</SelectItem>
          </SelectContent>
        </Select>
      </NajmDesignProvider>,
    );

    const themed = container.querySelector("[data-najm-theme]") as HTMLElement;
    const content = themed.querySelector('[data-slot="select-content"]') as HTMLElement;
    expect(content.style.borderWidth).toBe("2px");
    expect(content.style.borderColor).toBe("var(--border)");
  });

  test("applies the dropdown border recipe to menu surfaces", () => {
    const config = defineNajmDesignConfig({
      version: 1,
      theme: {},
      components: { dropdown: { borderWidth: "0" } },
    });
    const { container } = render(
      <NajmDesignProvider config={config}>
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NajmDesignProvider>,
    );

    const themed = container.querySelector("[data-najm-theme]") as HTMLElement;
    const content = themed.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement;
    expect(content.style.borderWidth).toBe("0px");
    expect(content.style.borderStyle).toBe("none");
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
