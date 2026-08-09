// ============================================================================
// najm-theme/server — appearance validation
// ============================================================================
//
// The configured wrapper around the pure policy in `contracts/appearance`. It
// exists to bind the application's limits to the check and to draw the one
// distinction the pure module cannot: a design arriving from a client and a
// design read back out of the database are the same shape but not the same
// problem.
//
// An invalid *inbound* design is a bad request, and the caller should be told
// exactly what is wrong with it. An invalid *stored* design is an operational
// fault — the row predates a validation rule, or somebody edited it by hand —
// and the right answer is to serve the factory design and tell the operator,
// without echoing the payload back to whoever happened to load the page.
// ============================================================================

import { Inject, Service } from "najm-core";
import type { NajmDesignConfig } from "najm-kit/server";

import { parseSafeDesignConfig } from "../../contracts/appearance";
import { describeThrown, reportDiagnostic } from "../../contracts/diagnostics";
import type { ThemeDiagnosticCode } from "../../contracts/diagnostics";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG } from "../tokens";

@Service()
export class AppearanceValidator {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  /**
   * Validates a design a client sent. Throws with a path on failure, which the
   * controller layer surfaces as a 400.
   */
  parseInbound(input: unknown): NajmDesignConfig {
    return parseSafeDesignConfig(input, this.config.limits.appearance);
  }

  /**
   * Validates a design read out of the database.
   *
   * Returns `undefined` instead of throwing, and emits a diagnostic carrying
   * the *reason*, never the payload. The rejected value is exactly the thing
   * that must not travel: it is untrusted content that already got past one
   * boundary, and a log line containing it is a second one.
   */
  parseStored(
    input: unknown,
    context: { scopeId: string; code: ThemeDiagnosticCode; detail?: string },
  ): NajmDesignConfig | undefined {
    if (input === null || input === undefined) return undefined;
    try {
      return parseSafeDesignConfig(input, this.config.limits.appearance);
    } catch (error) {
      reportDiagnostic(this.config.diagnostics, {
        code: context.code,
        scopeId: context.scopeId,
        detail: context.detail,
        error: describeThrown(error),
      });
      return undefined;
    }
  }

  /**
   * The application's factory design, validated once per call.
   *
   * Its failure propagates on purpose. A factory theme that does not parse is a
   * broken build, and the only useful behaviour is a loud one — a second
   * fallback would render an unstyled page and leave nobody any the wiser.
   */
  factory(): NajmDesignConfig {
    return parseSafeDesignConfig(this.config.factoryAppearance(), this.config.limits.appearance);
  }
}
