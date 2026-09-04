import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  resetClientAddressWarnings,
  resolveClientAddress,
  UNRESOLVED_CLIENT_ADDRESS,
} from "../src/clientAddress";

const resolve = (
  headers: Record<string, string | undefined>,
  trustedProxyHops: number | undefined,
  peerIp?: string,
) => resolveClientAddress(headers, trustedProxyHops, peerIp);

describe("trusted-hop client address resolution", () => {
  describe("hop counting", () => {
    test("zero hops ignores forwarded headers entirely", () => {
      expect(
        resolve({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "8.8.8.8" }, 0, "10.0.0.1"),
      ).toBe("10.0.0.1");
    });

    test("one hop takes the rightmost entry, which the trusted proxy wrote", () => {
      expect(resolve({ "x-forwarded-for": "203.0.113.7" }, 1)).toBe("203.0.113.7");
    });

    test("one hop ignores anything the client injected to the left", () => {
      expect(resolve({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }, 1)).toBe("203.0.113.7");
    });

    test("two hops step past one additional known proxy", () => {
      expect(
        resolve({ "x-forwarded-for": "1.2.3.4, 203.0.113.7, 198.51.100.2" }, 2),
      ).toBe("203.0.113.7");
    });

    test("a chain shorter than the configured boundary fails closed", () => {
      expect(resolve({ "x-forwarded-for": "203.0.113.7" }, 2)).toBe(UNRESOLVED_CLIENT_ADDRESS);
    });

    test("a missing chain under a positive hop count fails closed", () => {
      expect(resolve({}, 1, "10.0.0.1")).toBe(UNRESOLVED_CLIENT_ADDRESS);
    });
  });

  describe("rejecting attacker-shaped values", () => {
    test.each([
      ["an empty element", "  , 203.0.113.7", 2],
      ["a malformed literal", "not-an-ip, 203.0.113.7", 2],
      ["a port masquerading as an address", "203.0.113.7:8080", 1],
      ["an out-of-range octet", "203.0.113.999", 1],
      ["a bare token", "unknown", 1],
      ["an oversized chain element", `${"9".repeat(100)}`, 1],
    ])("%s never becomes key material", (_label, header, hops) => {
      const resolved = resolve({ "x-forwarded-for": header }, hops);
      expect(resolved).toBe(UNRESOLVED_CLIENT_ADDRESS);
    });

    test("the fail-closed value is fixed, not attacker-controlled", () => {
      const first = resolve({ "x-forwarded-for": "evil-one" }, 1);
      const second = resolve({ "x-forwarded-for": "evil-two" }, 1);
      expect(first).toBe(second);
    });

    test("x-real-ip is not a silent substitute for a required chain", () => {
      expect(resolve({ "x-real-ip": "203.0.113.7" }, 1)).toBe(UNRESOLVED_CLIENT_ADDRESS);
    });
  });

  describe("normalization", () => {
    test("IPv4 is preserved verbatim", () => {
      expect(resolve({ "x-forwarded-for": "203.0.113.7" }, 1)).toBe("203.0.113.7");
    });

    test("IPv6 is lowercased into stable key material", () => {
      expect(resolve({ "x-forwarded-for": "2001:DB8::A1" }, 1)).toBe("2001:db8::a1");
    });

    test("bracketed IPv6 loses its brackets", () => {
      expect(resolve({ "x-forwarded-for": "[2001:db8::1]" }, 1)).toBe("2001:db8::1");
    });

    test("an IPv4-mapped IPv6 address collapses to one representation", () => {
      expect(resolve({ "x-forwarded-for": "::ffff:203.0.113.7" }, 1)).toBe("203.0.113.7");
    });

    test("the same client cannot occupy two buckets through case alone", () => {
      expect(resolve({ "x-forwarded-for": "2001:DB8::1" }, 1)).toBe(
        resolve({ "x-forwarded-for": "2001:db8::1" }, 1),
      );
    });
  });

  describe("legacy compatibility path", () => {
    test("an unconfigured hop count keeps the historical leftmost behavior", () => {
      expect(resolve({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }, undefined)).toBe("1.2.3.4");
    });

    test("the legacy path still falls back to x-real-ip and the peer address", () => {
      expect(resolve({ "x-real-ip": "203.0.113.7" }, undefined)).toBe("203.0.113.7");
      expect(resolve({}, undefined, "10.0.0.1")).toBe("10.0.0.1");
    });
  });

  describe("configuration validation", () => {
    test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "%p is rejected as a hop count",
      (hops) => {
        expect(() => resolve({ "x-forwarded-for": "203.0.113.7" }, hops as number)).toThrow(
          /trustedProxyHops/i,
        );
      },
    );
  });
});

describe("misconfiguration diagnostics", () => {
  let warnings: string[];
  let restore: () => void;

  beforeEach(() => {
    resetClientAddressWarnings();
    warnings = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
    restore = () => {
      console.warn = original;
    };
  });

  afterEach(() => {
    restore();
    resetClientAddressWarnings();
  });

  test("an unconfigured hop count announces that keys are client-controlled", () => {
    resolve({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }, undefined);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("trustedProxyHops is not configured");
    expect(warnings[0]).toContain("leftmost X-Forwarded-For");
  });

  test("a chain shorter than the declared topology reports the collapse", () => {
    expect(resolve({ "x-forwarded-for": "203.0.113.7" }, 2)).toBe(UNRESOLVED_CLIENT_ADDRESS);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("shorter than the declared trustedProxyHops of 2");
    expect(warnings[0]).toContain("shares one rate-limit bucket");
  });

  test("a missing chain distinguishes an absent proxy from a short one", () => {
    expect(resolve({}, 1)).toBe(UNRESOLVED_CLIENT_ADDRESS);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("no X-Forwarded-For header");
  });

  test("an unusable boundary element is reported without echoing it", () => {
    const secret = "session-token-value";
    expect(resolve({ "x-forwarded-for": `1.2.3.4, ${secret}` }, 1)).toBe(
      UNRESOLVED_CLIENT_ADDRESS,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("hop 1");
    expect(warnings[0]).not.toContain(secret);
    expect(warnings[0]).not.toContain("1.2.3.4");
  });

  test("zero hops without a usable peer address is reported", () => {
    expect(resolve({ "x-forwarded-for": "203.0.113.7" }, 0)).toBe(UNRESOLVED_CLIENT_ADDRESS);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("trustedProxyHops is 0");
  });

  test("one cause is announced once, not once per request", () => {
    for (let index = 0; index < 25; index += 1) {
      resolve({ "x-forwarded-for": `10.0.0.${index}` }, 3);
    }

    expect(warnings).toHaveLength(1);
  });

  test("distinct causes are announced separately", () => {
    resolve({ "x-forwarded-for": "203.0.113.7" }, 2);
    resolve({}, 1);

    expect(warnings).toHaveLength(2);
  });

  test("a correctly declared topology stays silent", () => {
    expect(resolve({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }, 1)).toBe("203.0.113.7");
    expect(resolve({}, 0, "10.0.0.1")).toBe("10.0.0.1");

    expect(warnings).toEqual([]);
  });
});
