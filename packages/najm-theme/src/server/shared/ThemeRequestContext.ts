// ============================================================================
// najm-theme/server — request scope and actor resolution
// ============================================================================

import { Inject, Service } from "najm-core";
import type { Context } from "hono";

import { assertThemeScopeId } from "../../contracts/scope";
import type { ResolvedThemeConfig } from "../config";
import { THEME_CONFIG } from "../tokens";

@Service()
export class ThemeRequestContext {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  /** `null` when the request is anonymous or the principal has no usable id. */
  actorId(user: unknown): string | null {
    try {
      const resolved = this.config.resolveActorId(user);
      return typeof resolved === "string" && resolved.length > 0 ? resolved : null;
    } catch {
      // An attribution resolver that throws must not fail the mutation it was
      // only labelling. The row stores `null` and the audit says "unknown".
      return null;
    }
  }

  /**
   * Resolves the scope for this request and validates it before it can reach a
   * query, a storage namespace, or a URL.
   *
   * Validation here rather than at each use: a tenant resolver is application
   * code, it can return whatever a subdomain contained, and a scope of
   * `"../other"` would otherwise be a cross-tenant read.
   */
  async scopeId(c: Context, user?: unknown): Promise<string> {
    const resolved = await this.config.scope({
      request: c.req.raw,
      actorId: this.actorId(user),
    });
    return assertThemeScopeId(resolved, "theme.scope resolved value");
  }
}
