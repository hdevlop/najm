import { describe, test, expect, beforeEach } from "bun:test";
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";

import {
  NajmUIProvider,
  NajmPreferencesProvider,
  useNajmTheme,
  useNajmTimeZone,
  buildPaginationLabels,
  DEFAULT_PAGINATION_KEY_PREFIX,
  buildToolbarLabels,
  DEFAULT_TOOLBAR_KEY_PREFIX,
  useDocumentDirection,
} from "../src/index";
import { useNTableDefaults } from "../src/components/table";
import { useNajmDesign } from "../src/theme/design-provider";
import type { NajmDesignConfig } from "../src/theme/design-types";

const design: NajmDesignConfig = { version: 1, theme: {}, components: {} };

function ThemeProbe() {
  const { theme, setTheme } = useNajmTheme();
  return (
    <button type="button" data-testid="theme" onClick={() => void setTheme("dark")}>
      {theme}
    </button>
  );
}

function TimeZoneProbe() {
  const { timeZone, setTimeZone } = useNajmTimeZone();
  return (
    <button
      type="button"
      data-testid="tz"
      onClick={() => void setTimeZone("europe/paris")}
    >
      {timeZone}
    </button>
  );
}

function LabelProbe() {
  const { paginationLabels } = useNTableDefaults();
  return (
    <div>
      <span data-testid="rows-per-page">{paginationLabels?.rowsPerPage ?? "—"}</span>
      <span data-testid="go-to-page">{paginationLabels?.goToPage?.(3) ?? "—"}</span>
    </div>
  );
}

function ToolbarProbe() {
  const { toolbarLabels } = useNTableDefaults();
  return (
    <div>
      <span data-testid="view">{toolbarLabels?.view ?? "—"}</span>
      <span data-testid="mode-cards">{toolbarLabels?.modeCards ?? "—"}</span>
      <span data-testid="mode-option">
        {toolbarLabels?.modeOption?.("Cards") ?? "—"}
      </span>
    </div>
  );
}

function DirectionProbe() {
  const direction = useDocumentDirection();
  return <span data-testid="direction">{direction}</span>;
}

beforeEach(() => {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("dir");
  delete document.documentElement.dataset.timeZone;
});

describe("useDocumentDirection", () => {
  test("follows changes to the document direction", async () => {
    const { getByTestId } = render(<DirectionProbe />);

    expect(getByTestId("direction").textContent).toBe("ltr");
    document.documentElement.dir = "rtl";

    await waitFor(() =>
      expect(getByTestId("direction").textContent).toBe("rtl"),
    );
  });
});

describe("buildPaginationLabels", () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}(${JSON.stringify(params)})` : key;

  test("keys every label off the default prefix", () => {
    const labels = buildPaginationLabels(t);
    expect(DEFAULT_PAGINATION_KEY_PREFIX).toBe("common.pagination");
    expect(labels.rowsPerPage).toBe("common.pagination.rowsPerPage");
    expect(labels.pagination).toBe("common.pagination.pagination");
    expect(labels.firstPage).toBe("common.pagination.firstPage");
    expect(labels.lastPage).toBe("common.pagination.lastPage");
  });

  test("honours a custom prefix", () => {
    const labels = buildPaginationLabels(t, "table.paging");
    expect(labels.rowsPerPage).toBe("table.paging.rowsPerPage");
  });

  test("passes interpolation params to the translator", () => {
    const labels = buildPaginationLabels(t);
    expect(labels.goToPage?.(4)).toBe('common.pagination.goToPage({"page":4})');
    expect(labels.pageOf?.(2, 9)).toBe(
      'common.pagination.pageOf({"page":2,"pageCount":9})',
    );
    expect(labels.rowsSelected?.(3, 12)).toBe(
      'common.pagination.rowsSelected({"selected":3,"total":12})',
    );
  });
});

describe("buildToolbarLabels", () => {
  const t = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}(${JSON.stringify(params)})` : key;

  test("keys every label off the default prefix", () => {
    const labels = buildToolbarLabels(t);
    expect(DEFAULT_TOOLBAR_KEY_PREFIX).toBe("common.table");
    expect(labels.view).toBe("common.table.view");
    expect(labels.columns).toBe("common.table.columns");
    expect(labels.modeCards).toBe("common.table.modeCards");
    expect(labels.allOption).toBe("common.table.allOption");
  });

  test("honours a custom prefix", () => {
    const labels = buildToolbarLabels(t, "table.chrome");
    expect(labels.settings).toBe("table.chrome.settings");
  });

  test("interpolates the visible mode name into its accessible name", () => {
    const labels = buildToolbarLabels(t);
    expect(labels.modeOption?.("Cards")).toBe(
      'common.table.modeOption({"mode":"Cards"})',
    );
  });
});

describe("NajmUIProvider preferences", () => {
  test("seeds from initialTheme and applies it to the document", async () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design} initialTheme="dark">
        <ThemeProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("theme").textContent).toBe("dark");
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true),
    );
  });

  test("setTheme toggles the dark class and awaits onThemeChange", async () => {
    const seen: string[] = [];

    const { getByTestId } = render(
      <NajmUIProvider
        design={design}
        initialTheme="light"
        onThemeChange={async (theme) => {
          seen.push(theme);
        }}
      >
        <ThemeProbe />
      </NajmUIProvider>,
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(getByTestId("theme"));

    expect(getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await waitFor(() => expect(seen).toEqual(["dark"]));
  });

  test("normalizeTimeZone runs on the seed and on every set", () => {
    const { getByTestId } = render(
      <NajmUIProvider
        design={design}
        initialTimeZone="africa/cairo"
        normalizeTimeZone={(value) => value.toUpperCase()}
      >
        <TimeZoneProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("tz").textContent).toBe("AFRICA/CAIRO");

    fireEvent.click(getByTestId("tz"));

    expect(getByTestId("tz").textContent).toBe("EUROPE/PARIS");
    expect(document.documentElement.dataset.timeZone).toBe("EUROPE/PARIS");
  });

  test("defaults the time zone to UTC", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design}>
        <TimeZoneProbe />
      </NajmUIProvider>,
    );
    expect(getByTestId("tz").textContent).toBe("UTC");
  });

  test("keeps a real IANA zone with no normalizer supplied", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design} initialTimeZone="Africa/Casablanca">
        <TimeZoneProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("tz").textContent).toBe("Africa/Casablanca");
  });

  test("the default normalizer rejects a zone Intl cannot format", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design} initialTimeZone="Not/AZone">
        <TimeZoneProbe />
      </NajmUIProvider>,
    );

    // Falls back rather than throwing: a stale cookie must not break the page.
    expect(getByTestId("tz").textContent).toBe("UTC");
  });

  test("an outer NajmPreferencesProvider wins over the provider's own props", () => {
    const { getByTestId } = render(
      <NajmPreferencesProvider initialTheme="dark">
        <NajmUIProvider design={design} initialTheme="light">
          <ThemeProbe />
        </NajmUIProvider>
      </NajmPreferencesProvider>,
    );

    expect(getByTestId("theme").textContent).toBe("dark");
  });

  test("the hooks refuse to guess without a provider", () => {
    expect(() => render(<ThemeProbe />)).toThrow(/NajmUIProvider/);
  });
});

describe("NajmUIProvider height chain", () => {
  const themeDiv = (container: HTMLElement) =>
    container.querySelector("[data-najm-theme]");

  test("defaults to min-h-full, since the theme div would otherwise sever h-full", () => {
    const { container } = render(
      <NajmUIProvider design={design}>
        <span />
      </NajmUIProvider>,
    );

    expect(themeDiv(container)?.className).toBe("min-h-full");
  });

  test("merges a supplied className over the default", () => {
    const { container } = render(
      <NajmUIProvider design={design} className="bg-red-500">
        <span />
      </NajmUIProvider>,
    );

    expect(themeDiv(container)?.className).toContain("min-h-full");
    expect(themeDiv(container)?.className).toContain("bg-red-500");
  });

  test("a conflicting height utility wins, so the default stays opt-out", () => {
    const { container } = render(
      <NajmUIProvider design={design} className="min-h-0">
        <span />
      </NajmUIProvider>,
    );

    // tailwind-merge, not concatenation — otherwise both land and source order
    // decides, which the consumer cannot control.
    expect(themeDiv(container)?.className).toBe("min-h-0");
  });
});

describe("NajmUIProvider table defaults", () => {
  test("derives pagination labels from t", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design} t={(key) => `[${key}]`}>
        <LabelProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("rows-per-page").textContent).toBe(
      "[common.pagination.rowsPerPage]",
    );
  });

  test("leaves labels undefined with no t, so packaged English applies", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design}>
        <LabelProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("rows-per-page").textContent).toBe("—");
    expect(getByTestId("go-to-page").textContent).toBe("—");
  });

  test("tableDefaults overrides one key and keeps the translated rest", () => {
    const { getByTestId } = render(
      <NajmUIProvider
        design={design}
        t={(key) => `[${key}]`}
        tableDefaults={{ paginationLabels: { rowsPerPage: "Per page" } }}
      >
        <LabelProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("rows-per-page").textContent).toBe("Per page");
    expect(getByTestId("go-to-page").textContent).toBe(
      "[common.pagination.goToPage]",
    );
  });
});

describe("NajmUIProvider toolbar defaults", () => {
  test("derives toolbar labels from the same t", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design} t={(key) => `[${key}]`}>
        <ToolbarProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("view").textContent).toBe("[common.table.view]");
    expect(getByTestId("mode-cards").textContent).toBe(
      "[common.table.modeCards]",
    );
  });

  test("honours toolbarKeyPrefix", () => {
    const { getByTestId } = render(
      <NajmUIProvider
        design={design}
        t={(key) => `[${key}]`}
        toolbarKeyPrefix="table.chrome"
      >
        <ToolbarProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("view").textContent).toBe("[table.chrome.view]");
  });

  test("leaves labels undefined with no t, so packaged English applies", () => {
    const { getByTestId } = render(
      <NajmUIProvider design={design}>
        <ToolbarProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("view").textContent).toBe("—");
    expect(getByTestId("mode-option").textContent).toBe("—");
  });

  test("tableDefaults overrides one key and keeps the translated rest", () => {
    const { getByTestId } = render(
      <NajmUIProvider
        design={design}
        t={(key) => `[${key}]`}
        tableDefaults={{ toolbarLabels: { view: "Layout" } }}
      >
        <ToolbarProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("view").textContent).toBe("Layout");
    expect(getByTestId("mode-cards").textContent).toBe(
      "[common.table.modeCards]",
    );
  });
});

describe("NajmUIProvider without a design config", () => {
  test("renders and still serves preferences when `design` is omitted", () => {
    const { getByTestId } = render(
      <NajmUIProvider initialTheme="dark">
        <ThemeProbe />
      </NajmUIProvider>,
    );

    expect(getByTestId("theme").textContent).toBe("dark");
  });

  test("keeps one design identity across renders so tables below do not churn", () => {
    // The empty default is shared rather than built per render: NajmDesignProvider
    // memoizes on config.components/typography/layout, and a fresh literal would
    // invalidate that memo on every render of the whole tree.
    const seen = new Set<unknown>();

    function DesignProbe() {
      seen.add(useNajmDesign().components);
      return null;
    }

    const { rerender } = render(
      <NajmUIProvider>
        <DesignProbe />
      </NajmUIProvider>,
    );
    rerender(
      <NajmUIProvider>
        <DesignProbe />
      </NajmUIProvider>,
    );

    expect(seen.size).toBe(1);
  });
});
