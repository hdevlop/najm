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

beforeEach(() => {
  document.documentElement.className = "";
  delete document.documentElement.dataset.timeZone;
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
