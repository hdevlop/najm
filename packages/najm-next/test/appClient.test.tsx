import { describe, expect, test } from "bun:test";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { createAuthClient } from "najm-auth/client";
import { useAuthClient } from "najm-auth/client/react";
import { useNBranding } from "najm-kit";
import { useTranslation } from "najm-i18n/react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createNajmAppProvider,
  NajmAppProvider,
  type NajmClientLocationIntegration,
} from "../src/app/client";
import {
  bindNajmNextProvider,
  type NajmNextProviderContext,
} from "../src/app/react";

const snapshot = {
  session: null,
  preferences: {
    language: "ar",
    theme: "dark" as const,
    timeZone: "Africa/Casablanca",
  },
  appearance: {
    designConfig: { version: 1 as const, theme: {}, components: {} },
    revision: 1,
  },
  branding: { slots: {}, revision: 1 },
  settings: { locationConfig: { provider: "disabled" } },
};

const router = {
  back: () => {},
  forward: () => {},
  prefetch: () => {},
  push: () => {},
  refresh: () => {},
  replace: () => {},
} as never;

function LocationProvider({
  children,
  provider,
}: Readonly<{ children: React.ReactNode; provider: string }>) {
  return <section data-location={provider}>{children}</section>;
}

function Probe() {
  const queryClient = useQueryClient();
  const { language } = useTranslation();
  const branding = useNBranding();

  return (
    <span
      data-language={language}
      data-app-name={branding?.appName}
      data-query={queryClient instanceof QueryClient}
    />
  );
}

function ContextMark({
  children,
  name,
}: Readonly<{
  children: React.ReactNode;
  name: string;
}>) {
  const queryClient = useQueryClient();
  const authClient = useAuthClient();
  return (
    <section
      data-context={name}
      data-auth={authClient ? "yes" : "no"}
      data-query={queryClient instanceof QueryClient ? "yes" : "no"}
    >
      {children}
    </section>
  );
}

function UiContextMark({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language } = useTranslation();
  return (
    <ContextMark name="inside-ui">
      <section data-ui-language={language}>{children}</section>
    </ContextMark>
  );
}

const beforeUi = bindNajmNextProvider(
  ContextMark,
  (_context: NajmNextProviderContext<typeof snapshot, QueryClient>) => ({
    name: "before-ui",
  }),
);

const insideUi = bindNajmNextProvider(
  UiContextMark,
  (_context: NajmNextProviderContext<typeof snapshot, QueryClient>) => ({}),
);

describe("createNajmAppProvider", () => {
  test("mounts the complete app stack behind one provider", () => {
    let uiHookCalls = 0;
    const NajmAppProvider = createNajmAppProvider<typeof snapshot, { provider: string }>({
      authClient: createAuthClient({ baseURL: "/api" }),
      location: {
        Provider: LocationProvider,
        selectProps: (value) => value.settings.locationConfig,
      },
      useUiProps: () => {
        uiHookCalls += 1;
        return { appName: "Derived" };
      },
    });

    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <NajmAppProvider
          snapshot={snapshot}
          i18n={{
            translations: { en: {}, ar: {} },
            defaultLanguage: "en",
            supportedLanguages: ["en", "ar"],
          }}
          appName="Explicit"
        >
          <Probe />
        </NajmAppProvider>
      </AppRouterContext.Provider>,
    );

    expect(uiHookCalls).toBe(1);
    expect(html).toContain('data-location="disabled"');
    expect(html).toContain('data-language="ar"');
    expect(html).toContain('data-app-name="Explicit"');
    expect(html).toContain('data-query="true"');
  });
});

describe("NajmAppProvider", () => {
  test("accepts direct integration props and preserves extension placement", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <NajmAppProvider
          authClient={createAuthClient({ baseURL: "/api" })}
          snapshot={snapshot}
          location={{
            Provider: LocationProvider,
            selectProps: (value) => value.settings.locationConfig,
          }}
          extensions={{ beforeUi, insideUi }}
          i18n={{
            translations: { en: {}, ar: {} },
            defaultLanguage: "en",
            supportedLanguages: ["en", "ar"],
          }}
          appName="Direct"
        >
          <Probe />
        </NajmAppProvider>
      </AppRouterContext.Provider>,
    );

    const order = ["before-ui", "inside-ui"];
    expect(html.indexOf(`data-context="${order[0]}"`)).toBeLessThan(
      html.indexOf(`data-context="${order[1]}"`),
    );
    expect(html).toContain('data-context="before-ui" data-auth="yes" data-query="yes"');
    expect(html).toContain('data-context="inside-ui" data-auth="yes" data-query="yes"');
    expect(html).toContain('data-ui-language="ar"');
    expect(html).toContain('data-location="disabled"');
    expect(html).toContain('data-app-name="Direct"');
  });

  test("can disable Query without changing the full client entrypoint", () => {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <NajmAppProvider
          authClient={createAuthClient({ baseURL: "/api" })}
          snapshot={snapshot}
          query={false}
        >
          <main>no query</main>
        </NajmAppProvider>
      </AppRouterContext.Provider>,
    );

    expect(html).toContain("no query");
  });
});

const typedLocation: NajmClientLocationIntegration<
  typeof snapshot,
  { provider: string }
> = {
  Provider: LocationProvider,
  selectProps: (value) => value.settings.locationConfig,
};
void typedLocation;

const mismatchedLocation: NajmClientLocationIntegration<
  typeof snapshot,
  { provider: string }
> = {
  Provider: LocationProvider,
  // @ts-expect-error The selector must return the Provider's inferred props.
  selectProps: () => ({ unavailable: true }),
};
void mismatchedLocation;
