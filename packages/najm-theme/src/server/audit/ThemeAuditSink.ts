// ============================================================================
// najm-theme/server — audit sink
// ============================================================================
//
// Where audit events go is the application's decision — a table, a queue, an
// external service, or nowhere. The package only guarantees *when* it calls.
//
// The interesting part is `transactional`. An audit sink that writes to the
// same database can join the mutation's transaction, so "the branding changed"
// and "here is the record of it" either both happen or neither does. A sink
// that posts to an external service cannot, and pretending otherwise would mean
// a network timeout rolls back a save the administrator already saw succeed.
//
// So the sink declares which it is, and the package honours the declaration
// rather than guessing.
// ============================================================================

import { reportDiagnostic, type ThemeDiagnosticSink } from "../../contracts/diagnostics";
import { describeThrown } from "../../contracts/diagnostics";
import type { ThemeAuditEvent } from "./ThemeAuditEvents";

export interface ThemeAuditSink {
  /**
   * Called once per committed mutation.
   *
   * When `transactional` is true this runs *inside* the mutation's transaction,
   * receives the active transaction handle, and its failure rolls the whole
   * mutation back. When false — the default — it runs after commit and its
   * failure is contained.
   */
  record(event: ThemeAuditEvent, transaction?: unknown): void | Promise<void>;
  /** Defaults to `false`. Set true only for a sink writing the same database. */
  transactional?: boolean;
}

/**
 * Runs the sink, honouring its own declaration about failure.
 *
 * Post-commit sinks get their failure converted into a diagnostic: the state
 * write already committed, and throwing here would answer 500 to a request that
 * genuinely succeeded — the worst possible signal, because the client then
 * retries a mutation that already landed.
 */
export async function recordAudit(
  sink: ThemeAuditSink | undefined,
  event: ThemeAuditEvent,
  options: { transaction?: unknown; diagnostics?: ThemeDiagnosticSink } = {},
): Promise<void> {
  if (!sink) return;

  if (sink.transactional) {
    await sink.record(event, options.transaction);
    return;
  }

  try {
    await sink.record(event);
  } catch (error) {
    reportDiagnostic(options.diagnostics, {
      code: "audit.sink-failed",
      scopeId: event.scopeId,
      detail: event.action,
      error: describeThrown(error),
    });
  }
}
