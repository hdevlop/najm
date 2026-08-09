// ============================================================================
// najm-theme/server — branding routes
// ============================================================================

import {
  ArrayBufferBody,
  Body,
  ContentType,
  Controller,
  Ctx,
  Delete,
  Get,
  Inject,
  Params,
  Post,
  Put,
  ResMsg,
  User,
} from "najm-core";
import { Validate } from "najm-validation";
import type { Context } from "hono";

import { capabilitiesFor } from "../../contracts/capabilities";
import type { ResolvedThemeConfig } from "../config";
import { asHttp } from "../shared/errors";
import { ThemeRequestContext } from "../shared/ThemeRequestContext";
import { THEME_CONFIG } from "../tokens";
import { BrandingAssetService } from "./BrandingAssetService";
import {
  brandingAssetParams,
  brandingAssetUploadParams,
  resetBrandingDto,
  saveBrandingDto,
  type BrandingAssetParams,
  type BrandingAssetUploadParams,
  type ResetBrandingDto,
  type SaveBrandingDto,
} from "./BrandingDto";
import { BrandingService } from "./BrandingService";
import { BrandingValidator } from "./BrandingValidator";

/** Appended to the configured `basePath`. */
export const BRANDING_ROUTE_PREFIX = "/branding";

@Controller(BRANDING_ROUTE_PREFIX)
export class BrandingController {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  constructor(
    private service: BrandingService,
    private assets: BrandingAssetService,
    private validator: BrandingValidator,
    private request: ThemeRequestContext,
  ) {}

  @Get()
  @ResMsg("theme.branding.retrieved")
  async getBranding(@Ctx() c: Context, @User() user: unknown) {
    return this.service.getPublic(await this.request.scopeId(c, user));
  }

  /**
   * The administrative projection: slot metadata, what is customized, and what
   * each non-custom slot inherited from.
   *
   * Note what is still absent — storage namespaces, file paths on disk, the
   * list of uncommitted candidates, orphan counts. An administrator manages
   * branding through this; they do not need the storage layout to do it, and
   * anything here is one screenshot away from a support ticket.
   */
  @Get("/config")
  @ResMsg("theme.branding.retrieved")
  async getBrandingConfig(@Ctx() c: Context, @User() user: unknown) {
    const branding = await this.service.getAdmin(await this.request.scopeId(c, user));
    return {
      ...branding,
      features: this.config.features,
      capabilities: capabilitiesFor(this.config.features),
    };
  }

  @Put()
  @Validate(saveBrandingDto)
  @ResMsg("theme.branding.saved")
  async saveBranding(
    @Ctx() c: Context,
    @User() user: unknown,
    @Body() body: SaveBrandingDto,
  ) {
    return asHttp(async () =>
      this.service.save({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        expectedRevision: body.expectedRevision,
        slots: body.slots,
        discardFileNames: body.discardFileNames,
      }),
    );
  }

  @Post("/reset")
  @Validate(resetBrandingDto)
  @ResMsg("theme.branding.reset")
  async resetBranding(
    @Ctx() c: Context,
    @User() user: unknown,
    @Body() body: ResetBrandingDto,
  ) {
    return asHttp(async () =>
      this.service.reset({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
        expectedRevision: body.expectedRevision,
      }),
    );
  }

  /**
   * Uploads a candidate. Binary body, not JSON.
   *
   * `:fileName` is the client's own name for the file and is used for nothing
   * but the error message — the stored name is a UUID this package mints, so
   * neither a traversal sequence nor a colliding name in the path can reach
   * storage. It stays in the route because a browser upload with no name at all
   * is harder to debug from an access log than one that carries it.
   *
   * The bytes never travel as JSON. That is why this is REST-only and has no
   * MCP counterpart: a base64 image in a tool call is a multi-megabyte string
   * through a protocol built for text.
   */
  @Post("/assets/:slot/:fileName")
  @Validate({ params: brandingAssetUploadParams })
  @ResMsg("theme.branding.assetUploaded")
  async uploadAsset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Params() params: BrandingAssetUploadParams,
    @ArrayBufferBody() body: ArrayBuffer,
    @ContentType() contentType: string | undefined,
  ) {
    return asHttp(async () =>
      this.assets.uploadCandidate({
        scopeId: await this.request.scopeId(c, user),
        slot: this.validator.requireSlot(params.slot),
        body,
        declaredMimeType: contentType,
      }),
    );
  }

  /**
   * Serves a committed asset.
   *
   * Declared before the `:fileName` reconcile sibling below only in reading
   * order; the router matches on method and arity, and `POST .../reconcile`
   * cannot collide with `GET .../:fileName`.
   */
  @Get("/assets/:fileName")
  async serveAsset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Params() params: BrandingAssetParams,
  ): Promise<Response> {
    const scopeId = await this.request.scopeId(c, user);
    const { fileNames, mimeTypes } = await this.service.referencedFileNames(scopeId);

    return asHttp(async () =>
      this.assets.serve({
        scopeId,
        fileName: params.fileName,
        referencedFileNames: fileNames,
        mimeTypeByFileName: mimeTypes,
      }),
    );
  }

  @Delete("/assets/:fileName")
  @Validate({ params: brandingAssetParams })
  @ResMsg("theme.branding.assetDeleted")
  async deleteAsset(
    @Ctx() c: Context,
    @User() user: unknown,
    @Params() params: BrandingAssetParams,
  ) {
    const scopeId = await this.request.scopeId(c, user);
    const { fileNames } = await this.service.referencedFileNames(scopeId);

    return asHttp(async () =>
      this.assets.deleteCandidate({
        scopeId,
        fileName: params.fileName,
        referencedFileNames: fileNames,
      }),
    );
  }

  @Post("/assets/reconcile")
  @ResMsg("theme.branding.assetsReconciled")
  async reconcileAssets(@Ctx() c: Context, @User() user: unknown) {
    return asHttp(async () =>
      this.service.reconcileAssets({
        scopeId: await this.request.scopeId(c, user),
        actorId: this.request.actorId(user),
      }),
    );
  }
}
