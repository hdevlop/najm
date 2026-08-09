// ============================================================================
// najm-theme/contracts — diagnostics
// ============================================================================
//
// What the application learns when the package recovered from something.
//
// Deliberately narrow, and for one reason: the payloads that go wrong here are
// the interesting ones. A design config that fails validation is attacker- or
// operator-supplied JSON; a branding slot map that fails is a row someone
// edited by hand. Logging either verbatim is how a stored payload reaches a log
// aggregator, and from there a screen that renders it. `detail` is a summary
// the package writes, never a value it read.
// ============================================================================

export type ThemeDiagnosticCode =
  /** Stored appearance JSON did not validate; the factory design was served. */
  | "appearance.invalid-stored-config"
  /** Stored branding slot map did not validate; factory slots were served. */
  | "branding.invalid-slot-config"
  /** A stored preset did not validate and was omitted from the list. */
  | "preset.invalid-design"
  /** A superseded asset survived its post-commit cleanup. */
  | "asset.cleanup-failed"
  /** A draft was cancelled but one of its candidate uploads remained. */
  | "asset.candidate-cleanup-failed"
  /** Reconciliation could not enumerate or delete an unreferenced asset. */
  | "asset.reconcile-failed"
  /** The configured audit sink threw. The mutation itself still committed. */
  | "audit.sink-failed";

export interface ThemeDiagnostic {
  code: ThemeDiagnosticCode;
  scopeId?: string;
  /** A package-authored summary. Never a stored or uploaded value. */
  detail?: string;
  /** `"<name>: <message>"` for an `Error`; the type alone for anything else. */
  error?: string;
}

/**
 * Optional because there is no sensible default: a package cannot know whether
 * this application wants `console.warn`, a counter, or a pager.
 */
export type ThemeDiagnosticSink = (diagnostic: ThemeDiagnostic) => void;

/**
 * Turns a thrown value into a string safe to log.
 *
 * Only `Error` contributes text. Anything else reports its type alone: a
 * rejected storage call can carry a whole response, and a thrown object
 * stringified into a diagnostic is how bodies and credentials reach logs.
 */
export function describeThrown(value: unknown): string {
  return value instanceof Error
    ? `${value.name}: ${value.message}`
    : `non-error thrown: ${typeof value}`;
}

/**
 * Reports without ever letting the reporter take the caller down.
 *
 * Every call site here is already on a recovery path — the diagnostic explains
 * a fallback that has happened. A sink that throws must not convert a served
 * page into a 500.
 */
export function reportDiagnostic(
  sink: ThemeDiagnosticSink | undefined,
  diagnostic: ThemeDiagnostic,
): void {
  if (!sink) return;
  try {
    sink(diagnostic);
  } catch {
    // A broken reporter is not a reason to serve a broken page.
  }
}
