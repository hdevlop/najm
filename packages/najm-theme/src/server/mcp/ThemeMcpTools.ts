// ============================================================================
// najm-theme/server — MCP tools
// ============================================================================
//
// The same services the REST controllers call, exposed as tools. Not a second
// implementation: an MCP tool that reimplemented the revision protocol would be
// the one write path without it.
//
// Uploads are deliberately absent. A branding image reaches the server as
// binary over REST, and the alternative — base64 inside a JSON tool call — puts
// megabytes of encoded bytes through a protocol built for text, in a transcript
// that is frequently logged. The `theme_branding_get` tool reports what is set;
// replacing it is a browser action.
//
// Scope resolution has no request to work from here, so tools operate on the
// default scope. A tenant-aware installation should leave `mcp` off until it
// has decided how an agent names a tenant — silently defaulting to `platform`
// in a multi-tenant deployment would be the wrong answer, not a missing one.
// ============================================================================

import { Container, DI, Inject, Meta, Service } from "najm-core";
import { z } from "zod";

import { DEFAULT_THEME_SCOPE_ID } from "../../contracts/scope";
import { AppearanceService } from "../appearance/AppearanceService";
import { BrandingService } from "../branding/BrandingService";
import type { ResolvedThemeConfig } from "../config";
import { MCP_REGISTRY_TOKEN, resolvePeerService } from "../peers";
import { ThemePresetService } from "../presets/ThemePresetService";
import { THEME_CONFIG } from "../tokens";

const emptyInput = z.object({});

const applyPresetInput = z.object({
  presetId: z.string().uuid().describe("The preset id, as returned by theme_presets_list"),
  expectedRevision: z
    .number()
    .int()
    .positive()
    .describe("The appearance revision the caller read, from theme_appearance_get"),
});

const resetInput = z.object({
  expectedRevision: z
    .number()
    .int()
    .positive()
    .describe("The revision the caller read; the reset fails if it is stale"),
});

type ApplyPresetInput = z.infer<typeof applyPresetInput>;
type ResetInput = z.infer<typeof resetInput>;

interface RegisteredToolLike {
  name: string;
  description: string;
  methodKey: string;
  target: new (...args: never[]) => unknown;
  args: never[];
  validation?: { body?: { parse: (data: unknown) => unknown } };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

interface McpRegistryServiceLike {
  registerTool(tool: RegisteredToolLike): void;
}

@Service()
@Meta({ layer: "plugin" })
export class ThemeMcpTools {
  @DI() private container!: Container;
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  private registered = false;

  /**
   * Resolved during activation rather than injected through the constructor.
   *
   * Each domain service is registered only when its feature is on, so
   * constructor injection would make this class unresolvable in an
   * appearance-only installation that had also enabled MCP.
   *
   * `resolve` rather than `get`: these run in the same lifecycle phase as the
   * services they reach, and `get` throws on a singleton that has not been
   * constructed yet.
   */
  private appearance!: AppearanceService;
  private branding!: BrandingService;
  private presets!: ThemePresetService;

  async activate(): Promise<void> {
    if (!this.config.features.mcp || this.registered) return;

    const registry = await this.resolveMcpRegistry();
    const { features } = this.config;

    if (features.appearance) {
      this.appearance = (await this.container.resolve(
        AppearanceService as never,
      )) as AppearanceService;

      registry.registerTool({
        name: "theme_appearance_get",
        description: "Read the platform's current design configuration and its revision",
        methodKey: "appearanceGet",
        target: ThemeMcpTools as never,
        args: [],
        validation: { body: emptyInput },
        annotations: { readOnlyHint: true },
      });

      registry.registerTool({
        name: "theme_appearance_reset",
        description:
          "Reset the platform design to the factory theme. Requires the revision read from theme_appearance_get",
        methodKey: "appearanceReset",
        target: ThemeMcpTools as never,
        args: [],
        validation: { body: resetInput },
        annotations: { destructiveHint: true },
      });
    }

    if (features.presets) {
      this.presets = (await this.container.resolve(
        ThemePresetService as never,
      )) as ThemePresetService;

      registry.registerTool({
        name: "theme_presets_list",
        description: "List the saved theme presets for the platform",
        methodKey: "presetsList",
        target: ThemeMcpTools as never,
        args: [],
        validation: { body: emptyInput },
        annotations: { readOnlyHint: true },
      });

      registry.registerTool({
        name: "theme_preset_apply",
        description:
          "Apply a saved theme preset to the platform design. Requires the revision read from theme_appearance_get",
        methodKey: "presetApply",
        target: ThemeMcpTools as never,
        args: [],
        validation: { body: applyPresetInput },
        annotations: { idempotentHint: true },
      });
    }

    if (features.branding) {
      this.branding = (await this.container.resolve(
        BrandingService as never,
      )) as BrandingService;

      registry.registerTool({
        name: "theme_branding_get",
        description: "Read the platform's resolved branding image paths and their revision",
        methodKey: "brandingGet",
        target: ThemeMcpTools as never,
        args: [],
        validation: { body: emptyInput },
        annotations: { readOnlyHint: true },
      });
    }

    this.registered = true;
  }

  // --------------------------------------------------------------------------
  // Handlers — input already parsed by the MCP validation layer
  // --------------------------------------------------------------------------

  async appearanceGet() {
    return this.appearance.getAdmin(DEFAULT_THEME_SCOPE_ID);
  }

  async appearanceReset(input: ResetInput) {
    return this.appearance.reset({
      scopeId: DEFAULT_THEME_SCOPE_ID,
      // No request, so no authenticated principal. Recorded as unattributed
      // rather than as whoever configured the MCP server, which would be a
      // false name on an audit row.
      actorId: null,
      expectedRevision: input.expectedRevision,
    });
  }

  async presetsList() {
    return this.presets.list(DEFAULT_THEME_SCOPE_ID);
  }

  async presetApply(input: ApplyPresetInput) {
    return this.presets.apply({
      scopeId: DEFAULT_THEME_SCOPE_ID,
      actorId: null,
      presetId: input.presetId,
      expectedRevision: input.expectedRevision,
    });
  }

  async brandingGet() {
    return this.branding.getAdmin(DEFAULT_THEME_SCOPE_ID);
  }

  /**
   * Resolved by symbol rather than by `McpRegistryService` — see `../peers`.
   *
   * This mattered more here than anywhere else in the package: resolving the
   * dynamically imported class produced a *second*, empty registry. Every tool
   * below registered successfully into it, `mcp()` served the first one, and
   * `GET /mcp/tools` answered 200 with no `theme_*` tool in the list. Nothing
   * threw. `test/server/peers.test.ts` and the Playground MCP test now cover it.
   */
  private resolveMcpRegistry(): Promise<McpRegistryServiceLike> {
    return resolvePeerService<McpRegistryServiceLike>(this.container, MCP_REGISTRY_TOKEN, {
      packageName: "najm-mcp",
      feature: "mcp",
      registration: ".use(mcp({ … }))",
    });
  }
}
