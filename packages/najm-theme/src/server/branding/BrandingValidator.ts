// ============================================================================
// najm-theme/server — branding validation
// ============================================================================

import { Inject, Service } from "najm-core";

import {
  isBrandingAssetFileName,
  readBrandingSlotConfig,
  type BrandingSlotConfig,
  type BrandingSlotDefinition,
} from "../../contracts/branding";
import { reportDiagnostic } from "../../contracts/diagnostics";
import type { ResolvedThemeConfig } from "../config";
import { ThemeNotFoundError } from "../shared/errors";
import { THEME_CONFIG } from "../tokens";

/** `{ fileName }` sets a managed asset; `null` clears the slot back to its fallback. */
export type BrandingSlotPatch = Record<string, { fileName: string } | null>;

@Service()
export class BrandingValidator {
  @Inject(THEME_CONFIG) private config!: ResolvedThemeConfig;

  private registryKeys = new Set<string>();

  get slots(): readonly BrandingSlotDefinition[] {
    return this.config.brandingSlots;
  }

  private get keys(): ReadonlySet<string> {
    if (this.registryKeys.size !== this.config.brandingSlots.length) {
      this.registryKeys = new Set(this.config.brandingSlots.map((slot) => slot.key));
    }
    return this.registryKeys;
  }

  /**
   * Looks a slot up, or 404s.
   *
   * Not a 400: from the client's side an unregistered slot key and a mistyped
   * one are the same thing, and "no such slot" is the honest description.
   */
  requireSlot(key: string): BrandingSlotDefinition {
    const slot = this.config.brandingSlots.find((definition) => definition.key === key);
    if (!slot) throw new ThemeNotFoundError(`branding slot ${key} is not registered`);
    return slot;
  }

  /**
   * Reads a stored slot map, dropping what no longer belongs.
   *
   * Lenient here — a slot removed from the registry in a deploy must not make
   * every page fail — and strict on the write path below. Anything dropped is
   * reported once, by key, never by value.
   */
  readStored(input: unknown, scopeId: string): BrandingSlotConfig {
    const { config, droppedKeys } = readBrandingSlotConfig(input, this.keys);
    if (droppedKeys.length > 0) {
      reportDiagnostic(this.config.diagnostics, {
        code: "branding.invalid-slot-config",
        scopeId,
        detail: `ignored ${droppedKeys.length} unusable slot entr${droppedKeys.length === 1 ? "y" : "ies"}: ${droppedKeys.join(", ")}`,
      });
    }
    return config;
  }

  /**
   * Validates an inbound slot patch. Strict, because every failure here is a
   * client that would otherwise store something it could not render.
   */
  parsePatch(input: unknown): BrandingSlotPatch {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new TypeError("slots must be an object keyed by slot name");
    }

    const patch: BrandingSlotPatch = {};

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (!this.keys.has(key)) {
        throw new TypeError(`slots.${key} is not a registered branding slot`);
      }
      if (value === null) {
        patch[key] = null;
        continue;
      }
      if (typeof value !== "object" || value === null) {
        throw new TypeError(`slots.${key} must be null or { fileName }`);
      }

      const fileName = (value as { fileName?: unknown }).fileName;
      // The only thing a client may say about an asset is *which* one. Its MIME
      // type and size are re-derived from the stored bytes at commit, because
      // those two fields end up in a `Content-Type` header and a client that
      // could choose them could choose `text/html`.
      if (!isBrandingAssetFileName(fileName)) {
        throw new TypeError(`slots.${key}.fileName is not a managed branding asset name`);
      }
      patch[key] = { fileName };
    }

    return patch;
  }
}
