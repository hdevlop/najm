import { describe, expect, test } from "bun:test";
import {
  createCspReportHandler,
  NAJM_CSP_REDACTED,
  readNajmBoundedJson,
  sanitizeNajmCspReports,
} from "../src/security/reports";

function post(body: BodyInit | null, headers?: Record<string, string>): Request {
  return new Request("https://app.example/api/csp-report", {
    method: "POST",
    body,
    headers,
    // @ts-expect-error — required by undici/Bun for streaming bodies.
    duplex: "half",
  });
}

describe("report redaction (origins/keywords only, no path retention)", () => {
  test("strips credentials, query, fragment, and secret-bearing paths", () => {
    const [report] = sanitizeNajmCspReports({
      "csp-report": {
        "document-uri": "https://user:pass@app.example/reset-password?token=SECRET-RESET-TOKEN#frag",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.test:8443/some/secret/path?session=SECRET-SESSION#x",
      },
    });

    expect(report.documentUri).toBe("https://app.example");
    expect(report.blockedUri).toBe("https://evil.test:8443");
    const serialized = JSON.stringify(report);
    for (const secret of ["SECRET-RESET-TOKEN", "SECRET-SESSION", "user", "pass", "/some/secret/path", "frag"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("keeps approved keywords and collapses data/blob payloads", () => {
    const reports = sanitizeNajmCspReports([
      { body: { effectiveDirective: "script-src", blockedURL: "inline" } },
      { body: { effectiveDirective: "script-src", blockedURL: "eval" } },
      { body: { effectiveDirective: "img-src", blockedURL: "data:image/png;base64,SECRETBYTES" } },
      { body: { effectiveDirective: "media-src", blockedURL: "blob:https://app.example/uuid-with-coords-1-2" } },
    ]);

    expect(reports.map((report) => report.blockedUri)).toEqual(["inline", "eval", "data", "blob"]);
    expect(JSON.stringify(reports)).not.toContain("SECRETBYTES");
    expect(JSON.stringify(reports)).not.toContain("uuid-with-coords-1-2");
  });

  test("fails closed on non-web and opaque origins", () => {
    const reports = sanitizeNajmCspReports([
      { body: { effectiveDirective: "img-src", blockedURL: "file:///home/user/secret-address.png" } },
      { body: { effectiveDirective: "script-src", blockedURL: "file:///etc/hostname?token=SECRET" } },
      { body: { effectiveDirective: "script-src", blockedURL: "javascript:alert(document.cookie)" } },
      { body: { effectiveDirective: "connect-src", blockedURL: "wss://sockets.example/live?session=SECRET" } },
      { body: { effectiveDirective: "connect-src", blockedURL: "myapp://callback/path?code=SECRET" } },
    ]);

    expect(reports).toHaveLength(5);
    for (const report of reports) {
      expect(report.blockedUri).toBe(NAJM_CSP_REDACTED);
    }
    const serialized = JSON.stringify(reports);
    expect(serialized).not.toContain("null");
    for (const leak of ["secret-address", "/home/user", "/etc/hostname", "sockets.example", "myapp", "SECRET", "alert"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  test("maps relative and malformed values to the generic redacted keyword", () => {
    const reports = sanitizeNajmCspReports({
      "csp-report": {
        "document-uri": "/relative/path?token=SECRET",
        "violated-directive": "img-src",
        "blocked-uri": "not a url at all :::",
      },
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].documentUri).toBe(NAJM_CSP_REDACTED);
    expect(reports[0].blockedUri).toBe(NAJM_CSP_REDACTED);
    expect(JSON.stringify(reports)).not.toContain("SECRET");
    expect(NAJM_CSP_REDACTED).toBe("redacted");
  });

  test("understands the Reporting API batch envelope", () => {
    const reports = sanitizeNajmCspReports([
      { body: { effectiveDirective: "style-src", blockedURL: "inline", disposition: "report" } },
      { body: { effectiveDirective: "img-src", blockedURL: "https://evil.test/a?b=c" } },
    ]);

    expect(reports).toHaveLength(2);
    expect(reports[1].blockedUri).toBe("https://evil.test");
  });

  test("bounds every field and drops entries with no actionable field", () => {
    const [report] = sanitizeNajmCspReports({
      "csp-report": { "violated-directive": "x".repeat(5_000), "blocked-uri": "inline" },
    });
    expect(report.violatedDirective.length).toBeLessThanOrEqual(257);

    expect(sanitizeNajmCspReports({ "csp-report": {} })).toEqual([]);
    expect(sanitizeNajmCspReports(null)).toEqual([]);
    expect(sanitizeNajmCspReports("garbage")).toEqual([]);
  });

  test("never reflects attacker-controlled samples or cookies", () => {
    const [report] = sanitizeNajmCspReports({
      "csp-report": {
        "document-uri": "https://app.example/page",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.test/x",
        "script-sample": "alert(document.cookie)",
        "original-policy": "default-src 'none'; report-uri /api/csp-report",
      },
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("alert");
    expect(serialized).not.toContain("script-sample");
    expect(Object.keys(report).sort()).toEqual([
      "blockedUri",
      "disposition",
      "documentUri",
      "effectiveDirective",
      "statusCode",
      "violatedDirective",
    ]);
  });
});

describe("bounded body reading", () => {
  test("short-circuits an oversized declared length before reading", async () => {
    expect(await readNajmBoundedJson(post("x".repeat(10), { "content-length": "20000" }))).toBeNull();
  });

  test("cancels an unbounded stream early instead of buffering it", async () => {
    let produced = 0;
    let cancelled = false;
    const chunk = new TextEncoder().encode("z".repeat(4_096));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced >= 256 * 1024) return controller.close();
        produced += chunk.byteLength;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });

    expect(await readNajmBoundedJson(post(body))).toBeNull();
    expect(cancelled).toBe(true);
    expect(produced).toBeLessThanOrEqual(16_384);
  });

  test("reads a body just under the cap and rejects invalid limits loudly", async () => {
    const filler = "u".repeat(7_000);
    const payload = await readNajmBoundedJson(
      post(JSON.stringify({ "csp-report": { "blocked-uri": "inline", note: filler } })),
    );
    expect(payload).not.toBeNull();

    await expect(readNajmBoundedJson(post("{}"), 0)).rejects.toThrow("limitBytes");
    await expect(readNajmBoundedJson(post("{}"), -1)).rejects.toThrow("limitBytes");
  });

  test("returns null for empty and malformed bodies", async () => {
    expect(await readNajmBoundedJson(post(""))).toBeNull();
    expect(await readNajmBoundedJson(post("not json"))).toBeNull();
    expect(await readNajmBoundedJson(new Request("https://app.example/api/csp-report"))).toBeNull();
  });
});

describe("report handler contract", () => {
  test("answers 204 with an empty body for valid, malformed, and oversized input", async () => {
    const seen: unknown[] = [];
    const POST = createCspReportHandler({ sink: (report) => void seen.push(report) });

    const valid = await POST(post(JSON.stringify({
      "csp-report": {
        "document-uri": "https://app.example/page?token=SECRET",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.test/x?session=SECRET",
      },
    })));
    expect(valid.status).toBe(204);
    expect(await valid.text()).toBe("");
    expect(seen).toHaveLength(1);
    expect(JSON.stringify(seen)).not.toContain("SECRET");

    for (const body of ["not json", "", "[]", JSON.stringify({ "csp-report": {} })]) {
      const response = await POST(post(body));
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
    }
    const oversized = await POST(post("y".repeat(20_000)));
    expect(oversized.status).toBe(204);

    // The caller learns nothing: identical status and empty body either way.
    expect(seen).toHaveLength(1);
  });

  test("isolates a throwing sink without failing the report", async () => {
    let calls = 0;
    const POST = createCspReportHandler({
      sink: () => {
        calls += 1;
        throw new Error("sink backend down");
      },
    });

    const response = await POST(post(JSON.stringify([
      { body: { effectiveDirective: "script-src", blockedURL: "inline" } },
      { body: { effectiveDirective: "img-src", blockedURL: "https://evil.test/x" } },
    ])));
    expect(response.status).toBe(204);
    expect(calls).toBe(2);
  });

  test("still answers 204 when the request body is already locked", async () => {
    const seen: unknown[] = [];
    const POST = createCspReportHandler({ sink: (report) => void seen.push(report) });
    const locked = post(JSON.stringify({ "csp-report": { "blocked-uri": "inline" } }));
    locked.body!.getReader(); // Lock without release: the reader below throws.

    const response = await POST(locked);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(seen).toEqual([]);
  });

  test("rejects a non-function sink at construction", () => {
    // @ts-expect-error — invalid sink must fail fast.
    expect(() => createCspReportHandler({ sink: "log" })).toThrow("sink");
  });
});
