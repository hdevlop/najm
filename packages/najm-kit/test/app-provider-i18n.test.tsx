import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { defineI18n } from "najm-i18n";
import { useTranslation } from "najm-i18n/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { NajmAppProvider, type NajmAppI18n } from "../src/adapters/app";
import { useNajmFormat } from "../src/format/provider";

// `de-DE` for English on purpose: a language whose declared tag is nothing like
// the language itself is the only way to prove `locales` came from the metadata
// rather than from the bare language key.
const catalogs = {
  en: { greeting: "Hello", onlyInEnglish: "Base" },
  ar: { greeting: "مرحبا" },
};

const languageMetadata = {
  en: { locale: "de-DE", direction: "ltr" },
  ar: { locale: "ar-MA", direction: "rtl" },
} as const;

const snapshot: NajmAppI18n = {
  translations: catalogs,
  defaultLanguage: "en",
  supportedLanguages: ["en", "ar"],
  fallbackToDefaultLanguage: true,
  languageMetadata,
};

function Probe() {
  const { t, language, changeLanguage } = useTranslation();
  const format = useNajmFormat();

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="greeting">{t("greeting")}</span>
      <span data-testid="fallback">{t("onlyInEnglish")}</span>
      <span data-testid="money">{format.money(125_000)}</span>
      <button type="button" data-testid="to-ar" onClick={() => void changeLanguage("ar")}>
        ar
      </button>
    </div>
  );
}

const router = {
  back: () => {},
  forward: () => {},
  prefetch: () => {},
  push: () => {},
  refresh: () => {},
  replace: () => {},
} as never;

function renderApp(props: Partial<React.ComponentProps<typeof NajmAppProvider>> = {}) {
  globalThis.fetch = mock(async () => new Response(null, { status: 204 })) as never;

  // `NajmNextUIProvider` reads `useRouter()` to refresh after a preference
  // POST. Nothing here changes a preference, so a stub router is enough.
  return render(
    <AppRouterContext.Provider value={router}>
      <NajmAppProvider i18n={snapshot} initialLanguage="en" currency="MAD" {...props}>
        <Probe />
      </NajmAppProvider>
    </AppRouterContext.Provider>,
  );
}

describe("NajmAppProvider i18n snapshot", () => {
  test("serves catalogs, the default language, and the fallback policy", async () => {
    const view = renderApp();

    expect(view.getByTestId("language").textContent).toBe("en");
    expect(view.getByTestId("greeting").textContent).toBe("Hello");

    fireEvent.click(view.getByTestId("to-ar"));
    await waitFor(() => expect(view.getByTestId("language").textContent).toBe("ar"));

    expect(view.getByTestId("greeting").textContent).toBe("مرحبا");
    // `ar` has no `onlyInEnglish`; `fallbackToDefaultLanguage` came from the
    // snapshot, so the English string renders instead of the key.
    expect(view.getByTestId("fallback").textContent).toBe("Base");
  });

  test("derives locales from the declared metadata, not the language key", () => {
    const view = renderApp();

    const expected = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "MAD",
    }).format(1250);

    expect(view.getByTestId("money").textContent).toBe(expected);
  });

  test("derives the writing direction from the declared metadata", async () => {
    const view = renderApp();

    fireEvent.click(view.getByTestId("to-ar"));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  });

  test("takes a whole definition, not only its snapshot", async () => {
    const definition = defineI18n({
      translations: catalogs,
      defaultLanguage: "en",
      fallbackToDefaultLanguage: true,
      languageMetadata,
    });

    // The prop is structural: a definition carries every field it asks for, and
    // its methods are simply extra. Legal from a client component like this
    // one; a Server Component parent passes `definition.snapshot` instead.
    const view = renderApp({ i18n: definition });

    expect(view.getByTestId("greeting").textContent).toBe("Hello");
    expect(view.getByTestId("money").textContent).toBe(
      new Intl.NumberFormat("de-DE", { style: "currency", currency: "MAD" }).format(1250),
    );

    fireEvent.click(view.getByTestId("to-ar"));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
  });

  test("an explicit prop still wins over the snapshot", async () => {
    const view = renderApp({
      getLanguageDirection: () => "ltr",
      locales: { en: "en-US" },
    });

    const expected = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MAD",
    }).format(1250);
    expect(view.getByTestId("money").textContent).toBe(expected);

    fireEvent.click(view.getByTestId("to-ar"));
    await waitFor(() => expect(view.getByTestId("language").textContent).toBe("ar"));
    expect(document.documentElement.dir).toBe("ltr");
  });
});
