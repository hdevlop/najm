// ============================================================================
// najm-theme/server — theme preset routes
// ============================================================================

import {
  Body,
  Controller,
  Ctx,
  Delete,
  Get,
  Inject,
  Params,
  Post,
  ResMsg,
  User,
} from "najm-core";
import { Validate } from "najm-validation";
import type { Context } from "hono";

import type { ResolvedThemeConfig } from "../config";
import { asHttp } from "../shared/errors";
import { ThemeRequestContext } from "../shared/ThemeRequestContext";
import { THEME_CONFIG } from "../tokens";
import {
  applyThemePresetDto,
  createThemePresetDto,
  themePresetIdParam,
  type ApplyThemePresetDto,
  type CreateThemePresetDto,
  type ThemePresetIdParam,
} from "./ThemePresetDto";
import { ThemePresetService } from "./ThemePresetService";

/** Appended to the configured `basePath`. */
export const PRESETS_ROUTE_PREFIX = "/presets";

@Controller(PRESETS_ROUTE_PREFIX)
export class ThemePresetController {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private service: ThemePresetService,
    private request: ThemeRequestContext,
  ) {}

  /**
   * The preset library, plus the deletion policy the UI must not decide for
   * itself.
   *
   * `publicRead` does not reach this route. A preset library is a settings
   * feature — it is never part of the anonymous bootstrap — so it is guarded
   * whatever the public-read decision was.
   */
  @Get()
  @ResMsg("theme.presets.retrieved")
  async listPresets(@Ctx() c: Context, @User() user: unknown) {
    const presets = await this.service.list(await this.request.scopeId(c, user));
    return {
      presets,
      limits: {
        maxPresets: this.config.limits.maxPresets,
        allowBuiltInPresetDeletion: this.config.limits.allowBuiltInPresetDeletion,
      },
    };
  }

  @Post()
  @Validate(createThemePresetDto)
  @ResMsg("theme.presets.created")
  async createPreset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Body() body: CreateThemePresetDto,
  ) {
    return asHttp(async () =>
      this.service.create({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        name: body.name,
        designConfig: body.designConfig,
      }),
    );
  }

  /**
   * Applying takes `expectedRevision` and goes through the appearance lock: a
   * preset apply is an appearance write, and giving it a weaker concurrency
   * story than the Save button would make it the way to clobber someone.
   */
  @Post("/:id/apply")
  @Validate({ params: themePresetIdParam, body: applyThemePresetDto })
  @ResMsg("theme.presets.applied")
  async applyPreset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Params() params: ThemePresetIdParam,
    @Body() body: ApplyThemePresetDto,
  ) {
    return asHttp(async () =>
      this.service.apply({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        presetId: params.id,
        expectedRevision: body.expectedRevision,
      }),
    );
  }

  @Delete("/:id")
  @Validate({ params: themePresetIdParam })
  @ResMsg("theme.presets.deleted")
  async deletePreset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Params() params: ThemePresetIdParam,
  ) {
    return asHttp(async () =>
      this.service.delete({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        presetId: params.id,
      }),
    );
  }
}
