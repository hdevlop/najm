import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { createAuthClient } from "najm-auth/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import * as React from "react";

import { NajmAppProvider } from "../src/app/client";
import { defineNajmTanStackQuery } from "../src/query/tanstack";

const authClient = createAuthClient({ baseURL: "/api" });
const query = defineNajmTanStackQuery();
const i18n = {
  translations: { en: {}, ar: {} },
  defaultLanguage: "en",
  supportedLanguages: ["en", "ar"],
};
const router = {
  back() {},
  forward() {},
  prefetch() {},
  push() {},
  refresh() {},
  replace() {},
} as never;

function makeSnapshot(provider: string, revision: number) {
  return {
    session: null,
    preferences: {
      language: "en",
      theme: "light" as const,
      timeZone: "Africa/Casablanca",
    },
    appearance: {
      designConfig: { version: 1 as const, theme: {}, components: {} },
      revision,
    },
    branding: { slots: {}, revision },
    settings: { locationConfig: { provider } },
  };
}

function LocationProvider({
  children,
  provider,
}: Readonly<{ children: React.ReactNode; provider: string }>) {
  return <section data-testid="location" data-provider={provider}>{children}</section>;
}

const observedClients: object[] = [];

function StatefulProbe() {
  const queryClient = useQueryClient();
  const [count, setCount] = React.useState(0);
  observedClients.push(queryClient);
  return (
    <button data-testid="state" type="button" onClick={() => setCount((value) => value + 1)}>
      {count}
    </button>
  );
}

function tree(snapshot: ReturnType<typeof makeSnapshot>) {
  return (
    <AppRouterContext.Provider value={router}>
      <NajmAppProvider
        authClient={authClient}
        snapshot={snapshot}
        query={{ ...query }}
        location={{
          Provider: LocationProvider,
          selectProps: (value) => value.settings.locationConfig,
        }}
        i18n={i18n}
        appName={`revision-${snapshot.branding.revision}`}
      >
        <StatefulProbe />
      </NajmAppProvider>
    </AppRouterContext.Provider>
  );
}

describe("NajmAppProvider mount lifetime", () => {
  test("keeps child state and QueryClient while fresh props update location", () => {
    observedClients.length = 0;
    const view = render(tree(makeSnapshot("disabled", 1)));
    const firstClient = observedClients.at(-1);

    fireEvent.click(view.getByTestId("state"));
    expect(view.getByTestId("state").textContent).toBe("1");

    view.rerender(tree(makeSnapshot("leaflet", 2)));

    expect(view.getByTestId("state").textContent).toBe("1");
    expect(view.getByTestId("location").getAttribute("data-provider")).toBe("leaflet");
    expect(observedClients.at(-1)).toBe(firstClient);
  });

  test("isolates Query clients between independent mounts", () => {
    const clients: object[] = [];
    function ClientProbe() {
      clients.push(useQueryClient());
      return null;
    }

    render(
      <AppRouterContext.Provider value={router}>
        <NajmAppProvider authClient={authClient} snapshot={makeSnapshot("disabled", 1)}>
          <ClientProbe />
        </NajmAppProvider>
        <NajmAppProvider authClient={authClient} snapshot={makeSnapshot("disabled", 2)}>
          <ClientProbe />
        </NajmAppProvider>
      </AppRouterContext.Provider>,
    );

    expect(clients).toHaveLength(2);
    expect(clients[0]).not.toBe(clients[1]);
  });

  test("rejects changing Query policy without an intentional remount", () => {
    const view = render(tree(makeSnapshot("disabled", 1)));
    const replacement = defineNajmTanStackQuery({ queries: { staleTime: 5 } });

    expect(() => view.rerender(
      <AppRouterContext.Provider value={router}>
        <NajmAppProvider
          authClient={authClient}
          snapshot={makeSnapshot("disabled", 2)}
          query={replacement}
        >
          <StatefulProbe />
        </NajmAppProvider>
      </AppRouterContext.Provider>,
    )).toThrow("requires remounting");
  });
});
