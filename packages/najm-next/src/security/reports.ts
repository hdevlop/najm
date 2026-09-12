/**
 * `najm-next/security/reports` — bounded CSP violation report handling.
 *
 * Framework-neutral (`Request` in, `Response` out) and directly usable as a
 * Next route handler without booting the Najm backend:
 *
 * ```ts
 * // app/api/csp-report/route.ts
 * import { createCspReportHandler } from "najm-next/security/reports";
 *
 * export const runtime = "nodejs";
 * export const dynamic = "force-dynamic";
 * export const POST = createCspReportHandler();
 * ```
 *
 * Redaction rule (frozen D6 — origins/keywords only, no path retention):
 * `http:`/`https:` URLs are reduced to their origin (credentials, path,
 * query, and fragment removed); `data:`/`blob:` payloads collapse to
 * keywords; inline, eval, self, and none stay as keywords; relative,
 * malformed, non-web (file/javascript/custom/ws), and opaque values become a
 * generic redacted keyword. Raw JSON, exceptions, source samples, cookies,
 * tokens, addresses, coordinates, and provider keys are never emitted.
 */

export interface NajmCspReport {
  readonly documentUri: string;
  readonly violatedDirective: string;
  readonly effectiveDirective: string;
  readonly blockedUri: string;
  readonly disposition: string;
  readonly statusCode: string;
}

/** A diagnostic sink receives one sanitized report at a time. */
export type NajmCspReportSink = (report: NajmCspReport) => void;

/** Reports are small; anything larger is not a report worth parsing. */
export const NAJM_CSP_REPORT_MAX_BODY_BYTES = 8_192;
export const NAJM_CSP_REPORT_MAX_FIELD_LENGTH = 256;

/** Generic keyword for relative, malformed, or otherwise unsafe URLs. */
export const NAJM_CSP_REDACTED = "redacted";

const TRUNCATION_MARK = "…";
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/g;
const KEYWORD_PATTERN = /^(?:inline|eval|self|none)$/i;
const ABSOLUTE_URL_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

function truncate(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  const clean = value.replace(CONTROL_PATTERN, "");
  if (clean === "") return "";
  return clean.length > NAJM_CSP_REPORT_MAX_FIELD_LENGTH
    ? `${clean.slice(0, NAJM_CSP_REPORT_MAX_FIELD_LENGTH)}${TRUNCATION_MARK}`
    : clean;
}

/**
 * Reduce a reported URL to the part that identifies *what* was blocked.
 * Fail-closed: anything that is not an approved keyword or a parseable
 * absolute URL becomes the generic redacted keyword, so secrets in paths,
 * queries, fragments, credentials, or scheme payloads can never reach a log.
 */
function sanitizeUrl(value: unknown): string {
  const raw = truncate(value);
  if (raw === "") return "";
  const compact = raw.trim();
  if (compact === "") return "";
  // Scheme payloads collapse to keywords — data/blob bodies are never retained.
  if (/^data:/i.test(compact)) return "data";
  if (/^blob:/i.test(compact)) return "blob";
  // Keywords browsers emit for blocked inline/eval/self navigations.
  if (KEYWORD_PATTERN.test(compact)) return compact.toLowerCase();
  // Relative, protocol-relative, and malformed values carry no safe origin.
  if (!ABSOLUTE_URL_PATTERN.test(compact)) return NAJM_CSP_REDACTED;
  try {
    const url = new URL(compact);
    // Fail closed on non-web and opaque origins: file/javascript/custom
    // schemes either expose local paths/payloads or normalize to the literal
    // "null" origin, neither of which may reach a diagnostic sink. Only
    // normalized http:/https: origins are retained.
    if (url.protocol !== "http:" && url.protocol !== "https:") return NAJM_CSP_REDACTED;
    return url.origin;
  } catch {
    return NAJM_CSP_REDACTED;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Accept both report shapes: the legacy `application/csp-report` envelope
 * and the Reporting API's `application/reports+json` batch. Every field is
 * bounded and every URL is redacted; entries with no actionable field are
 * dropped. Total by construction: JSON-decoded payloads contain only plain
 * data, and URL parsing is guarded, so this function does not throw.
 */
export function sanitizeNajmCspReports(payload: unknown): NajmCspReport[] {
  const entries = Array.isArray(payload)
    ? payload.map((entry) => asRecord(asRecord(entry).body))
    : [asRecord(asRecord(payload)["csp-report"])];

  return entries
    .map((entry) => ({
      documentUri: sanitizeUrl(entry["document-uri"] ?? entry.documentURL),
      violatedDirective: truncate(entry["violated-directive"] ?? entry.violatedDirective),
      effectiveDirective: truncate(entry["effective-directive"] ?? entry.effectiveDirective),
      blockedUri: sanitizeUrl(entry["blocked-uri"] ?? entry.blockedURL),
      disposition: truncate(entry.disposition),
      statusCode: truncate(String(entry["status-code"] ?? entry.statusCode ?? "")),
    }))
    .filter((report) => report.effectiveDirective !== "" || report.violatedDirective !== "" || report.blockedUri !== "");
}

/**
 * Read a bounded JSON body. Returns `null` rather than throwing so the
 * handler answers 204 identically for valid, malformed, and oversized input —
 * a violation report is fire-and-forget, and distinguishing rejections would
 * give an unauthenticated caller free reconnaissance.
 *
 * The cap bounds the *read*, not just the result: the stream is consumed
 * chunk by chunk and cancelled the moment the running total exceeds the
 * limit, so peak memory stays near one chunk past the cap even when the
 * sender omits `Content-Length`. A declared length above the cap still
 * short-circuits before a single byte is read.
 */
export async function readNajmBoundedJson(
  request: Request,
  limitBytes: number = NAJM_CSP_REPORT_MAX_BODY_BYTES,
): Promise<unknown | null> {
  if (!Number.isInteger(limitBytes) || limitBytes <= 0) {
    throw new TypeError("najm-next/security/reports: limitBytes must be a positive integer");
  }

  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limitBytes) return null;

  const body = request.body;
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > limitBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  try {
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(joined));
  } catch {
    return null;
  }
}

function defaultSink(report: NajmCspReport): void {
  console.warn("[csp] violation", report);
}

export interface NajmCspReportHandlerOptions {
  /**
   * Diagnostic sink override. A throwing sink is isolated per report and
   * never fails the 204 response.
   */
  readonly sink?: NajmCspReportSink;
}

/**
 * Create the `/api/csp-report` POST handler. Always answers 204 with an empty
 * body — for valid reports, malformed bodies, oversized streams, and sink
 * failures alike — so browsers never retry and callers learn nothing about
 * internal limits.
 */
export function createCspReportHandler(
  options: NajmCspReportHandlerOptions = {},
): (request: Request) => Promise<Response> {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new TypeError("najm-next/security/reports: handler options must be an object");
  }
  const sink = options.sink ?? defaultSink;
  if (typeof sink !== "function") {
    throw new TypeError("najm-next/security/reports: sink must be a function");
  }

  return async function cspReportHandler(request: Request): Promise<Response> {
    let payload: unknown | null;
    try {
      payload = await readNajmBoundedJson(request);
    } catch {
      // A diagnostic-input failure outside the bounded reader itself (for
      // example an already-locked request body) still answers 204: the
      // report is fire-and-forget, and the failure carries no
      // caller-visible signal either way. Construction-time option errors
      // above keep throwing and are deliberately not caught here.
      payload = null;
    }
    if (payload !== null) {
      for (const report of sanitizeNajmCspReports(payload)) {
        try {
          sink(report);
        } catch {
          // Diagnostic delivery must never fail a fire-and-forget report.
        }
      }
    }
    return new Response(null, { status: 204 });
  };
}
