// ============================================================================
// najm-theme/server — appearance routes
// ============================================================================
//
// Thin on purpose: resolve the scope, resolve the actor, hand the command to
// the service, translate the failure. No policy decision is taken here — the
// guards are applied by the plugin, the validation lives in the validator, and
// the revision protocol lives in the service.
//
// The class path is a placeholder. `theme()` re-applies `@Controller()` with
// the configured `basePath` at registration, so `/theme/appearance` and
// `/settings/appearance` are the same code.
// ============================================================================

import { Body, Controller, Ctx, Get, Post, Put, ResMsg, User } from "najm-core";
import { Validate } from "najm-validation";
import type { Context } from "hono";

import { pickAppearancePatch } from "../../contracts/appearance";
import { capabilitiesFor } from "../../contracts/capabilities";
import type { ResolvedThemeConfig } from "../config";
import { Inject } from "najm-core";
import { asHttp } from "../shared/errors";
import { ThemeRequestContext } from "../shared/ThemeRequestContext";
import { THEME_CONFIG } from "../tokens";
import {
  resetAppearanceDto,
  saveAppearanceDto,
  type ResetAppearanceDto,
  type SaveAppearanceDto,
} from "./AppearanceDto";
import { AppearanceService } from "./AppearanceService";

/** Appended to the configured `basePath`. */
export const APPEARANCE_ROUTE_PREFIX = "/appearance";

@Controller(APPEARANCE_ROUTE_PREFIX)
export class AppearanceController {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private service: AppearanceService,
    private request: ThemeRequestContext,
  ) {}

  /**
   * The public read. Complete design plus revision, nothing else.
   *
   * This is the endpoint the server-render bootstrap calls before there is a
   * session, so it carries no `updatedBy`, no `isFactory`, and no capability
   * projection — an anonymous visitor learns the colours and nothing about who
   * chose them.
   */
  @Get()
  @ResMsg("theme.appearance.retrieved")
  async getAppearance(@Ctx() c: Context, @User() user: unknown) {
    return this.service.getPublic(await this.request.scopeId(c, user));
  }

  /** The administrative read: adds provenance and the capability projection. */
  @Get("/config")
  @ResMsg("theme.appearance.retrieved")
  async getAppearanceConfig(@Ctx() c: Context, @User() user: unknown) {
    const appearance = await this.service.getAdmin(await this.request.scopeId(c, user));
    return {
      ...appearance,
      features: this.config.features,
      capabilities: capabilitiesFor(this.config.features),
      limits: {
        maxDesignBytes: this.config.limits.appearance.maxDesignBytes,
      },
    };
  }

  @Put()
  @Validate(saveAppearanceDto)
  @ResMsg("theme.appearance.saved")
  async saveAppearance(
    @Ctx() c: Context,
    @User() user: unknown,
    @Body() body: SaveAppearanceDto,
  ) {
    return asHttp(async () =>
      this.service.save({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        expectedRevision: body.expectedRevision,
        patch: pickAppearancePatch(body.designConfig),
      }),
    );
  }

  /**
   * A named action, not `PUT { designConfig: null }`.
   *
   * Reset is destructive and irreversible from the client's side, so it gets a
   * verb of its own — a generic setter that happens to mean "discard
   * everything" when handed the right value is how it gets called by accident.
   */
  @Post("/reset")
  @Validate(resetAppearanceDto)
  @ResMsg("theme.appearance.reset")
  async resetAppearance(
    @Ctx() c: Context,
    @User() user: unknown,
    @Body() body: ResetAppearanceDto,
  ) {
    return asHttp(async () =>
      this.service.reset({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        expectedRevision: body.expectedRevision,
      }),
    );
  }
}
