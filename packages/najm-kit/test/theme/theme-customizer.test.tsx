import { describe, expect, test } from "bun:test";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { NThemeCustomizer } from "../../src/components/ThemeCustomizer";
import type {
  NThemeCustomizerProps,
  NThemeCustomizerTab,
} from "../../src/components/ThemeCustomizer";
import type { NajmDesignConfig } from "../../src/theme/design-types";
import type { NajmMode } from "../../src/theme/types";
import { parseNajmDesignConfig } from "../../src/theme/design-config";
import * as najmUI from "../../src/index";

function buildConfig(): NajmDesignConfig {
  return parseNajmDesignConfig({
    theme: {
      mode: "light",
      accent: "violet",
      radius: "8px",
      tokens: {
        primary: "oklch(0.6 0.2 290)",
        "primary-foreground": "oklch(1 0 0)",
      },
    },
    typography: {
      baseSize: "16px",
      scale: "default",
    },
    components: {
      sidebar: { showSectionLabels: true, showSectionSeparators: true },
      input: { borderWidth: "1px" },
    },
    layout: { pageGutter: "16px", sectionGap: "16px" },
  });
}

function renderCustomizer(
  overrides: Partial<NThemeCustomizerProps> = {},
  factoryOverride?: NajmDesignConfig,
) {
  const value = overrides.value ?? buildConfig();
  const factoryValue = factoryOverride ?? value;
  const onChange = overrides.onChange ?? (() => {});
  const onPreviewModeChange = overrides.onPreviewModeChange ?? (() => {});
  const props: NThemeCustomizerProps = {
    value,
    factoryValue,
    onChange,
    previewMode: overrides.previewMode ?? ("light" as NajmMode),
    onPreviewModeChange,
    ...overrides,
  };
  return render(<NThemeCustomizer {...props} />);
}

function queryTabBar(container: HTMLElement) {
  return {
    list: container.querySelector("[data-slot='tabs-list']"),
    triggers: container.querySelectorAll("[data-slot='tabs-trigger']"),
  };
}

function queryResetButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector(
    "button[aria-label='Reset section']",
  ) as HTMLButtonElement | null;
}

describe("NThemeCustomizer - default (showTabs=true)", () => {
  test("renders the internal tab bar with Theme and Typography triggers", () => {
    const { container, getByText } = renderCustomizer();
    const { list, triggers } = queryTabBar(container);
    expect(list).toBeTruthy();
    expect(triggers.length).toBe(2);
    expect(getByText("Theme")).toBeTruthy();
    expect(getByText("Typography")).toBeTruthy();
  });

  test("showTabs=true explicit matches the default rendering", () => {
    const { container } = renderCustomizer({ showTabs: true });
    expect(queryTabBar(container).list).toBeTruthy();
    expect(queryTabBar(container).triggers.length).toBe(2);
  });
});

describe("NThemeCustomizer - direct mode (showTabs=false, tabs=['theme'])", () => {
  test("renders Theme controls and Components/Layout controls, no tab list, no Typography", () => {
    const { container, getByText, queryByText } = renderCustomizer({
      tabs: ["theme"],
      showTabs: false,
    });
    const { list, triggers } = queryTabBar(container);
    expect(list).toBeNull();
    expect(triggers.length).toBe(0);

    expect(getByText("Surface")).toBeTruthy();
    expect(getByText("Layout")).toBeTruthy();

    expect(queryByText("Typography")).toBeNull();
    expect(queryByText("Font")).toBeNull();
    expect(queryByText("Base size")).toBeNull();
  });

  test("keeps preview-mode behavior in direct mode (showPreviewMode=true)", () => {
    const { container, getByText } = renderCustomizer({
      tabs: ["theme"],
      showTabs: false,
      showPreviewMode: true,
    });
    expect(getByText("Preview mode")).toBeTruthy();
    expect(getByText("Light")).toBeTruthy();
    expect(getByText("Dark")).toBeTruthy();
  });

  test("hides preview-mode control in direct mode when showPreviewMode=false", () => {
    const { queryByText } = renderCustomizer({
      tabs: ["theme"],
      showTabs: false,
      showPreviewMode: false,
    });
    expect(queryByText("Preview mode")).toBeNull();
  });

  test("reset section targets Theme (tokens, components, layout)", () => {
    const factory = buildConfig();
    const current: NajmDesignConfig = {
      ...factory,
      theme: {
        ...factory.theme,
        tokens: {
          ...(factory.theme.tokens ?? {}),
          primary: "oklch(0.99 0.2 99)",
        },
      },
      layout: { pageGutter: "48px", sectionGap: "48px" },
      components: {
        ...(factory.components ?? {}),
        sidebar: { showSectionLabels: false, showSectionSeparators: false },
      },
    };

    let changed: NajmDesignConfig | null = null;
    const { container } = renderCustomizer(
      {
        tabs: ["theme"],
        showTabs: false,
        value: current,
        onChange: (next) => {
          changed = next;
        },
      },
      factory,
    );

    const resetButton = queryResetButton(container);
    expect(resetButton).toBeTruthy();
    fireEvent.click(resetButton!);

    expect(changed).not.toBeNull();
    const next = changed as unknown as NajmDesignConfig;
    expect(next.theme.tokens?.primary).toBe(factory.theme.tokens?.primary);
    expect(next.layout?.pageGutter).toBe(factory.layout?.pageGutter);
    expect(next.layout?.sectionGap).toBe(factory.layout?.sectionGap);
    expect(next.components?.sidebar?.showSectionLabels).toBe(
      factory.components?.sidebar?.showSectionLabels,
    );
    expect(next.components?.sidebar?.showSectionSeparators).toBe(
      factory.components?.sidebar?.showSectionSeparators,
    );
  });
});

describe("NThemeCustomizer - direct mode (showTabs=false, tabs=['typography'])", () => {
  test("renders Typography controls, no Theme controls, no tab list", () => {
    const { container, getByText, queryByText } = renderCustomizer({
      tabs: ["typography"],
      showTabs: false,
    });
    const { list, triggers } = queryTabBar(container);
    expect(list).toBeNull();
    expect(triggers.length).toBe(0);

    expect(getByText("Base size")).toBeTruthy();
    expect(getByText("Advanced typography")).toBeTruthy();

    expect(queryByText("Surface")).toBeNull();
    expect(queryByText("Layout")).toBeNull();
  });

  test("reset section targets Typography only", () => {
    const factory = buildConfig();
    const current: NajmDesignConfig = {
      ...factory,
      typography: {
        ...(factory.typography ?? {}),
        baseSize: "18px",
        scale: "compact",
      },
    };
    let changed: NajmDesignConfig | null = null;
    const { container } = renderCustomizer(
      {
        tabs: ["typography"],
        showTabs: false,
        value: current,
        onChange: (next) => {
          changed = next;
        },
      },
      factory,
    );

    const resetButton = queryResetButton(container);
    expect(resetButton).toBeTruthy();
    fireEvent.click(resetButton!);

    expect(changed).not.toBeNull();
    const next = changed as unknown as NajmDesignConfig;
    expect(next.typography?.baseSize).toBe(factory.typography?.baseSize);
    expect(next.typography?.scale).toBe(factory.typography?.scale);
    expect(next.theme.tokens?.primary).toBe(current.theme.tokens?.primary);
  });
});

describe("NThemeCustomizer - direct mode fallback behavior", () => {
  test("omitted tabs in direct mode renders Theme deterministically", () => {
    const { container, getByText } = renderCustomizer({
      showTabs: false,
    });
    expect(queryTabBar(container).list).toBeNull();
    expect(getByText("Surface")).toBeTruthy();
  });

  test("empty tabs in direct mode falls back to Theme without crashing", () => {
    const { container, getByText } = renderCustomizer({
      tabs: [] as readonly NThemeCustomizerTab[],
      showTabs: false,
    });
    expect(queryTabBar(container).list).toBeNull();
    expect(getByText("Surface")).toBeTruthy();
  });

  test("invalid tab values fall back to Theme without crashing", () => {
    const { container, getByText } = renderCustomizer({
      tabs: ["bogus" as unknown as NThemeCustomizerTab],
      showTabs: false,
    });
    expect(queryTabBar(container).list).toBeNull();
    expect(getByText("Surface")).toBeTruthy();
  });

  test("duplicate tab values are deduped (Theme only)", () => {
    const { container, getByText } = renderCustomizer({
      tabs: ["theme", "theme"],
      showTabs: false,
    });
    expect(queryTabBar(container).list).toBeNull();
    expect(getByText("Surface")).toBeTruthy();
  });
});

describe("NThemeCustomizer - direct mode disabled state", () => {
  test("disables the rendered controls and the reset button", () => {
    const { container } = renderCustomizer({
      tabs: ["theme"],
      showTabs: false,
      disabled: true,
    });
    const resetButton = queryResetButton(container);
    expect(resetButton).toBeTruthy();
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);

    const root = container.querySelector(
      "[data-najm-theme-customizer='']",
    ) as HTMLElement | null;
    expect(root?.getAttribute("data-disabled")).toBe("");
  });
});

describe("NThemeCustomizer - public exports", () => {
  test("root barrel exports NThemeCustomizer", () => {
    expect(najmUI.NThemeCustomizer).toBeDefined();
    expect(typeof najmUI.NThemeCustomizer).toBe("function");
  });

  test("NThemeCustomizerProps is exposed (type import does not throw)", () => {
    const sample: NThemeCustomizerProps | null = null;
    expect(sample).toBeNull();
  });
});