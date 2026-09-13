import { describe, expect, test } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  bindNajmNextProvider,
  NajmNextAppProvider,
  type NajmNextProviderBinding,
} from "../src/app/react";

type Snapshot = { session: { user: string } | null; settings: { enabled: boolean } };
type QueryClient = { id: string };

function Mark({
  name,
  clientId,
  enabled,
  children,
}: {
  name: string;
  clientId?: string;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  return <section data-provider={name} data-client={clientId} data-enabled={enabled}>{children}</section>;
}

function binding(name: string): NajmNextProviderBinding<Snapshot, QueryClient> {
  return bindNajmNextProvider(Mark, ({ snapshot, queryClient }) => ({
    name,
    clientId: queryClient?.id,
    enabled: snapshot.settings.enabled,
  }));
}

describe("NajmNextAppProvider", () => {
  test("composes every enabled owner once in the documented order", () => {
    let created = 0;
    const html = renderToStaticMarkup(
      <NajmNextAppProvider<Snapshot, QueryClient>
        snapshot={{ session: null, settings: { enabled: true } }}
        createQueryClient={() => ({ id: `query-${++created}` })}
        providers={{
          auth: binding("auth"),
          query: binding("query"),
          ui: binding("ui"),
          branding: binding("branding"),
          location: binding("location"),
        }}
        extensions={{
          beforeUi: binding("before-ui"),
          insideUi: binding("inside-ui"),
        }}
      >
        <main>application</main>
      </NajmNextAppProvider>,
    );

    expect(created).toBe(1);
    expect(html.match(/data-provider=/g)).toHaveLength(7);
    const order = ["auth", "query", "before-ui", "ui", "branding", "inside-ui", "location"];
    let offset = -1;
    for (const name of order) {
      const next = html.indexOf(`data-provider=\"${name}\"`);
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }
    expect(html.match(/data-client=\"query-1\"/g)).toHaveLength(7);
    expect(html.match(/data-enabled=\"true\"/g)).toHaveLength(7);
  });

  test("omits optional owners without inventing contexts", () => {
    const html = renderToStaticMarkup(
      <NajmNextAppProvider snapshot={{ public: true }} providers={{}}>
        <main>minimal</main>
      </NajmNextAppProvider>,
    );

    expect(html).toBe("<main>minimal</main>");
  });

  test("accepts an app-owned QueryClient and rejects two owners", () => {
    expect(() => renderToStaticMarkup(
      <NajmNextAppProvider<Snapshot, QueryClient>
        snapshot={{ session: null, settings: { enabled: false } }}
        queryClient={{ id: "existing" }}
        createQueryClient={() => ({ id: "other" })}
        providers={{}}
      >
        child
      </NajmNextAppProvider>,
    )).toThrow("not both");
  });
});
