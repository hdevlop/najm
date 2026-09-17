import { describe, expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { composeNajmProxy, type NajmAuthProxy } from "../src/security";
import { buildKafilStyleApp, buildSchoolStyleApp } from "./apps";

const EMPTY_LOCATION = { imgSrc: [] as string[], connectSrc: [] as string[] };

function request(pathname: string, init?: RequestInit): Request {
  return new Request(`https://app.example${pathname}`, init);
}

/** Captures what the composition forwards so tests assert the real values. */
function stubAuth(handler: (req: Request, headers: Headers) => Response | Promise<Response>): NajmAuthProxy & {
  lastRequestHeaders: () => Record<string, string>;
} {
  let last: Record<string, string> = {};
  return {
    lastRequestHeaders: () => last,
    async proxy(req: Request, init?: { requestHeaders?: HeadersInit }) {
      last = Object.fromEntries(new Headers(init?.requestHeaders).entries());
      return handler(req, new Headers(req.headers));
    },
  };
}

describe("proxy composition around the auth contract", () => {
  test("forwards the policy and nonce into rendering and applies the response policy", async () => {
    const auth = stubAuth((_req, downstream) => NextResponse.next({ request: { headers: downstream } }));
    const proxy = composeNajmProxy({
      auth,
      app: buildKafilStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: { NODE_ENV: "production" },
    });

    const response = await proxy(request("/dashboard"));
    const responsePolicy = response.headers.get("content-security-policy") ?? "";
    const forwarded = auth.lastRequestHeaders();

    expect(forwarded["content-security-policy"]).toBe(responsePolicy);
    expect(forwarded["x-nonce"]).toMatch(/^[A-Za-z0-9+/=_-]+$/);
    expect(responsePolicy).toContain(`'nonce-${forwarded["x-nonce"]}'`);
  });

  test("generates a fresh nonce per request", async () => {
    const auth = stubAuth(() => NextResponse.next());
    const proxy = composeNajmProxy({
      auth,
      app: buildSchoolStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: { NODE_ENV: "production" },
    });

    await proxy(request("/"));
    const first = auth.lastRequestHeaders()["x-nonce"];
    await proxy(request("/"));
    expect(auth.lastRequestHeaders()["x-nonce"]).not.toBe(first);
  });

  test("preserves redirects, status, body, headers, and multiple Set-Cookie values", async () => {
    const auth = stubAuth(() => {
      const response = NextResponse.redirect("https://app.example/login?from=%2Fdashboard", 307);
      response.headers.append("Set-Cookie", "a=1; Path=/; HttpOnly");
      response.headers.append("Set-Cookie", "b=2; Path=/; HttpOnly");
      response.headers.set("x-auth-note", "recovered");
      return response;
    });
    const proxy = composeNajmProxy({
      auth,
      app: buildKafilStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: {},
    });

    const response = await proxy(request("/dashboard"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?from=%2Fdashboard");
    expect(response.headers.get("x-auth-note")).toBe("recovered");
    // Verified with getSetCookie (not a joined parse) so no value is merged or dropped.
    expect(response.headers.getSetCookie()).toEqual([
      "a=1; Path=/; HttpOnly",
      "b=2; Path=/; HttpOnly",
    ]);
    expect(response.headers.get("content-security-policy")).toContain("report-uri /api/csp-report");
  });

  test("preserves a plain reconstructed body byte-for-byte", async () => {
    const body = JSON.stringify({ ok: true });
    const auth = stubAuth(() => new Response(body, {
      status: 201,
      headers: { "content-type": "application/json", "x-keep": "yes" },
    }));
    const proxy = composeNajmProxy({
      auth,
      app: buildKafilStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: {},
    });

    const response = await proxy(request("/api/echo", { method: "POST", body: "{}" }));
    expect(response.status).toBe(201);
    expect(await response.text()).toBe(body);
    expect(response.headers.get("x-keep")).toBe("yes");
  });

  test("emits exactly one enforcing policy even when upstream set one", async () => {
    const auth = stubAuth(() => new NextResponse("ok", {
      headers: { "content-security-policy": "default-src 'none'" },
    }));
    const proxy = composeNajmProxy({
      auth,
      app: buildSchoolStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: {},
    });

    const response = await proxy(request("/"));
    const policies = response.headers.get("content-security-policy") ?? "";
    // No commas: a duplicated header would arrive comma-joined, and no valid
    // policy token contains a comma.
    expect(policies).not.toContain(",");
    expect(policies).toContain("https://*.googleapis.com");
    expect(policies).not.toContain("default-src 'none'");
  });

  test("propagates auth failures instead of masking them", async () => {
    const failure = new Error("auth backend unavailable");
    const auth = stubAuth(() => { throw failure; });
    const proxy = composeNajmProxy({
      auth,
      app: buildKafilStyleApp(),
      resolveLocationCsp: () => EMPTY_LOCATION,
      env: {},
    });

    await expect(proxy(request("/"))).rejects.toBe(failure);
  });

  test("fails fast on an invalid composition, not per request", () => {
    const auth = stubAuth(() => NextResponse.next());
    const app = buildKafilStyleApp();
    expect(() => composeNajmProxy({ auth, app, resolveLocationCsp: () => EMPTY_LOCATION, env: {} }))
      .not.toThrow();
    expect(() => composeNajmProxy({
      // @ts-expect-error — missing proxy function.
      auth: {},
      app,
      resolveLocationCsp: () => EMPTY_LOCATION,
    })).toThrow("proxy");
    expect(() => composeNajmProxy({
      auth,
      // @ts-expect-error — invalid app.
      app: { id: "bad" },
      resolveLocationCsp: () => EMPTY_LOCATION,
    })).toThrow("auth");
  });

  test("reads the environment lazily per request", async () => {
    const auth = stubAuth(() => NextResponse.next());
    const env: Record<string, string | undefined> = { NODE_ENV: "production" };
    const proxy = composeNajmProxy({ auth, app: buildKafilStyleApp(), resolveLocationCsp: () => EMPTY_LOCATION, env });

    await proxy(request("/"));
    expect(auth.lastRequestHeaders()["content-security-policy"]).not.toContain("unsafe-eval");
    env.NODE_ENV = "development";
    await proxy(request("/"));
    expect(auth.lastRequestHeaders()["content-security-policy"]).toContain("unsafe-eval");
  });

  test("derives location CSP directly from the app definition", async () => {
    const auth = stubAuth(() => NextResponse.next());
    const base = buildKafilStyleApp();
    const app = { ...base, location: true } as const;
    const proxy = composeNajmProxy({ auth, app, env: { NODE_ENV: "production" } });

    const response = await proxy(request("/dashboard"));
    expect(response.headers.get("content-security-policy")).toContain(
      "https://tile.openstreetmap.org",
    );
  });
});
