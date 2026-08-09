import { describe, expect, it } from "bun:test";
import * as React from "react";
import { screen, waitFor } from "@testing-library/react";

import { NThemeBrandingSettings } from "../../src/react/components/NThemeBrandingSettings";
import { NThemeSettingsActions } from "../../src/react/components/NThemeSettingsActions";
import { useNThemeSettings } from "../../src/react/providers/NThemeSettingsProvider";
import {
  THEME_LANGUAGES,
  THEME_UI_LOCALES,
  createThemeTranslator,
} from "../../src/react/translations";
import { makeFakeClient, renderWithProvider } from "./fixtures";

function Ready() {
  const value = useNThemeSettings();
  return <span data-testid="ready">{value.loading ? "loading" : "ready"}</span>;
}

async function mount(props: Parameters<typeof renderWithProvider>[1] = {}) {
  const view = renderWithProvider(
    <>
      <Ready />
      <NThemeBrandingSettings />
      <NThemeSettingsActions />
    </>,
    props,
  );
  await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("ready"));
  return view;
}

// ============================================================================
// Catalog parity
//
// A missing translation does not fail at runtime — `najm-i18n` falls back and
// the user reads English inside an Arabic sheet, which is far easier to ship
// than to notice. Comparing the key sets is what makes that a test failure.
// ============================================================================

function collectKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("catalog parity", () => {
  const english = collectKeys(THEME_UI_LOCALES.en).sort();

  it("ships four languages", () => {
    expect(THEME_LANGUAGES.sort()).toEqual(["ar", "en", "es", "fr"]);
  });

  for (const language of ["fr", "ar", "es"] as const) {
    it(`${language} has exactly the English key set`, () => {
      expect(collectKeys(THEME_UI_LOCALES[language]).sort()).toEqual(english);
    });

    it(`${language} translates every value — no copied English strings in the action labels`, () => {
      const t = createThemeTranslator({ language });
      for (const key of ["theme.actions.save", "theme.actions.cancel", "theme.status.clean"]) {
        expect(t(key)).not.toBe(createThemeTranslator({ language: "en" })(key));
      }
    });
  }

  it("keeps every placeholder that English declares", () => {
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();

    for (const key of english) {
      const source = createThemeTranslator({ language: "en" })(key);
      for (const language of ["fr", "ar", "es"] as const) {
        expect(placeholders(createThemeTranslator({ language })(key))).toEqual(
          placeholders(source),
        );
      }
    }
  });
});

describe("label resolution", () => {
  it("prefers a consumer override over the catalog", () => {
    const t = createThemeTranslator({
      language: "en",
      overrides: { "theme.actions.save": "Publish" },
    });
    expect(t("theme.actions.save")).toBe("Publish");
  });

  it("prefers a consumer override over the application translator", () => {
    const t = createThemeTranslator({
      language: "en",
      t: () => "From the app catalog",
      overrides: { "theme.actions.save": "Publish" },
    });
    expect(t("theme.actions.save")).toBe("Publish");
  });

  it("uses the application translator when it has an entry", () => {
    const t = createThemeTranslator({ language: "en", t: () => "From the app catalog" });
    expect(t("theme.actions.save")).toBe("From the app catalog");
  });

  it("falls through when the translator echoes the key back", () => {
    // The convention for "no entry". Treating it as an answer would print
    // `theme.actions.save` in the button.
    const t = createThemeTranslator({ language: "fr", t: (key) => key });
    expect(t("theme.actions.save")).toBe("Enregistrer");
  });

  it("falls back to English for a key a translation is missing", () => {
    const t = createThemeTranslator({ language: "de" });
    expect(t("theme.actions.save")).toBe("Save changes");
  });

  it("shows the key itself for one nobody defined, rather than nothing", () => {
    const t = createThemeTranslator({ language: "en" });
    expect(t("app.branding.emailHeader")).toBe("app.branding.emailHeader");
  });

  it("interpolates named placeholders", () => {
    const t = createThemeTranslator({ language: "en" });
    expect(t("theme.branding_ui.inheritedFrom", { slot: "Sidebar logo" })).toBe(
      "Inherited from Sidebar logo",
    );
  });

  it("leaves an unknown placeholder untouched instead of printing undefined", () => {
    const t = createThemeTranslator({
      language: "en",
      overrides: { "x.y": "Hello {who} from {where}" },
    });
    expect(t("x.y", { who: "Najm" })).toBe("Hello Najm from {where}");
  });
});

describe("rendered surface", () => {
  it("renders French labels end to end", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client, language: "fr" });

    expect(view.container.textContent).toContain("Enregistrer");
    expect(view.container.textContent).toContain("Logo de la barre latérale");
  });

  it("renders Arabic labels end to end", async () => {
    const { client } = makeFakeClient();
    const view = await mount({ client, language: "ar" });

    expect(view.container.textContent).toContain("حفظ التغييرات");
    expect(view.container.textContent).toContain("شعار الشريط الجانبي");
  });

  it("renders correctly under dir=rtl without a second stylesheet", async () => {
    document.documentElement.setAttribute("dir", "rtl");
    try {
      const { client } = makeFakeClient();
      const view = await mount({ client, language: "ar" });

      // The layout uses logical properties only, so the same markup mirrors.
      // What the test can assert here is that nothing physical crept in.
      const actions = view.container.querySelector(".najm-theme-actions-buttons")!;
      expect(actions).toBeTruthy();
      expect(actions.getAttribute("style") ?? "").not.toContain("margin-left");
      expect(actions.getAttribute("style") ?? "").not.toContain("margin-right");
    } finally {
      document.documentElement.removeAttribute("dir");
    }
  });
});
