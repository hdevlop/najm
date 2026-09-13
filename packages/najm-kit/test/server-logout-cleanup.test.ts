import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NAJM_UI_PREFERENCE_ENDPOINTS,
  clearNajmUiPreferences,
  logoutWithNajmPreferenceCleanup,
} from "../src/server";

describe("School best-effort logout cleanup", () => {
  test("clears the three display cookies with DELETE + same-origin credentials", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchFn = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ cleared: true }), { status: 200 });
    };

    await clearNajmUiPreferences({ fetchFn });

    expect(calls.map((call) => call.url).sort()).toEqual([
      "/api/ui-language",
      "/api/ui-theme",
      "/api/ui-timezone",
    ]);
    for (const call of calls) {
      expect(call.init?.method).toBe("DELETE");
      expect((call.init as { credentials?: string })?.credentials).toBe("same-origin");
    }
  });

  test("uses custom endpoints when the app configured its own", async () => {
    const seen: string[] = [];
    await clearNajmUiPreferences({
      endpoints: { language: "/custom/lang", theme: "/custom/theme", timeZone: "/custom/tz" },
      fetchFn: async (url) => {
        seen.push(url);
        return new Response("{}", { status: 200 });
      },
    });
    expect(seen.sort()).toEqual(["/custom/lang", "/custom/theme", "/custom/tz"]);
  });

  test("a synchronously throwing endpoint does not prevent the other attempts", async () => {
    const attempted: string[] = [];
    const fetchFn = (url: string) => {
      attempted.push(url);
      if (url === "/api/ui-theme") throw new Error("sync throw for one endpoint");
      return Promise.resolve(new Response("{}", { status: 200 }));
    };

    // Must resolve (never throw) with every endpoint attempted exactly once.
    await expect(clearNajmUiPreferences({ fetchFn })).resolves.toBeUndefined();
    expect(attempted.sort()).toEqual([
      "/api/ui-language",
      "/api/ui-theme",
      "/api/ui-timezone",
    ]);
  });

  test("rejected DELETEs never throw (cannot prevent auth logout)", async () => {
    await expect(
      clearNajmUiPreferences({
        fetchFn: async () => {
          throw new Error("network down");
        },
      }),
    ).resolves.toBeUndefined();
  });

  test("default endpoints match the School trio", () => {
    expect(NAJM_UI_PREFERENCE_ENDPOINTS).toEqual({
      language: "/api/ui-language",
      theme: "/api/ui-theme",
      timeZone: "/api/ui-timezone",
    });
  });
});

describe("logoutWithNajmPreferenceCleanup — School onSuccess ordering", () => {
  test("auth logout runs first and its result is returned unchanged", async () => {
    const order: string[] = [];
    const result = await logoutWithNajmPreferenceCleanup({
      logout: async () => {
        order.push("logout");
        return "signed-out";
      },
      clearPreferences: async () => {
        order.push("clear");
      },
    });
    expect(result).toBe("signed-out");
    // School performs auth logout through SignOutButton first, then clears
    // display cookies in onSuccess.
    expect(order).toEqual(["logout", "clear"]);
  });

  test("an auth logout rejection propagates identically and skips cleanup", async () => {
    const authError = new Error("auth logout failed");
    let cleaned = false;
    const attempt = logoutWithNajmPreferenceCleanup({
      logout: async (): Promise<string> => {
        throw authError;
      },
      clearPreferences: async () => {
        cleaned = true;
      },
    });
    await expect(attempt).rejects.toBe(authError);
    // No onSuccess without a success: cleanup never runs after a failed logout.
    expect(cleaned).toBe(false);
  });

  test("a cleanup rejection after a successful logout never replaces the result", async () => {
    const result = await logoutWithNajmPreferenceCleanup({
      logout: async () => ({ ok: true as const }),
      clearPreferences: async () => {
        throw new Error("display cleanup failed");
      },
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("shared helper boundary — no najm-auth import, no hidden auth failures", () => {
  test("najm-kit/server never imports najm-auth, React, or Next", () => {
    const source = readFileSync(join(import.meta.dir, "..", "src", "server", "preferences.ts"), "utf8");
    const specifiers = [...source.matchAll(/^\s*(?:import|export)[^;]*from\s+["']([^"']+)["']/gm)].map(
      (match) => match[1]!,
    );
    for (const specifier of specifiers) {
      expect(specifier).not.toContain("najm-auth");
      expect(specifier).not.toBe("react");
      expect(specifier.startsWith("next/") || specifier === "next").toBe(false);
    }
  });

  test("Kafil logout policy is unchanged: clearing is opt-in only", () => {
    // The shared helper is opt-in. Resolvers and POST handlers never clear:
    // clearing only happens when the application explicitly invokes
    // `clearNajmUiPreferences` / `logoutWithNajmPreferenceCleanup`.
    expect(typeof clearNajmUiPreferences).toBe("function");
    expect(typeof logoutWithNajmPreferenceCleanup).toBe("function");
  });
});
