import { describe, expect, test } from "bun:test";

import {
  defineNajmTanStackQuery,
  getHttpErrorStatus,
  retryServerErrors,
} from "../src/query/tanstack";

describe("Najm TanStack Query integration", () => {
  test("provides balanced zero-config defaults", () => {
    const integration = defineNajmTanStackQuery();
    const defaults = integration.createClient().getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.gcTime).toBe(10 * 60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);

    const retry = defaults.queries?.retry;
    expect(typeof retry).toBe("function");
    if (typeof retry !== "function") throw new Error("retry policy missing");
    expect(retry(0, Object.assign(new Error("server"), { status: 503 }))).toBe(true);
    expect(retry(1, Object.assign(new Error("server"), { status: 503 }))).toBe(false);
    expect(retry(0, Object.assign(new Error("client"), { status: 422 }))).toBe(false);
    expect(retry(0, new TypeError("network"))).toBe(true);
  });

  test("deep-merges query and mutation overrides", () => {
    const defaults = defineNajmTanStackQuery({
      queries: { refetchOnWindowFocus: true, retry: false },
      mutations: { networkMode: "always" },
    }).createClient().getDefaultOptions();

    expect(defaults.queries?.staleTime).toBe(60_000);
    expect(defaults.queries?.gcTime).toBe(10 * 60_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.mutations?.networkMode).toBe("always");
  });

  test("reads common HTTP error shapes and validates retry attempts", () => {
    expect(getHttpErrorStatus({ status: 401 })).toBe(401);
    expect(getHttpErrorStatus({ response: { status: 502 } })).toBe(502);
    expect(getHttpErrorStatus(new Error("unknown"))).toBeUndefined();
    expect(() => retryServerErrors({ attempts: -1 })).toThrow(
      "non-negative integer",
    );
  });
});
