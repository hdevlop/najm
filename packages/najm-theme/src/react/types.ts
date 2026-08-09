// ============================================================================
// najm-theme/react — public types
// ============================================================================

import type { NajmDesignConfig } from "../contracts";
import type {
  AdminBrandingSlot,
  BrandingPreviewAspect,
} from "../contracts/branding";
import type { NajmThemeFeatures, ThemeCapabilities } from "../contracts/capabilities";
import type { PublicThemePreset } from "../contracts/presets";

/** What `GET {basePath}/appearance/config` returns. */
export interface AdminAppearanceResponse {
  designConfig: NajmDesignConfig;
  revision: number;
  isFactory: boolean;
  updatedAt: string | null;
  updatedByActorId: string | null;
  features: NajmThemeFeatures;
  capabilities: ThemeCapabilities;
  limits: { maxDesignBytes: number };
}

/** What `GET {basePath}/branding/config` returns. */
export interface AdminBrandingResponse {
  slots: AdminBrandingSlot[];
  revision: number;
  updatedAt: string | null;
  updatedByActorId: string | null;
  features: NajmThemeFeatures;
  capabilities: ThemeCapabilities;
}

/** What `GET {basePath}/presets` returns. */
export interface ThemePresetsResponse {
  presets: PublicThemePreset[];
  limits: { maxPresets: number; allowBuiltInPresetDeletion: boolean };
}

export interface UploadedBrandingAsset {
  fileName: string;
  mimeType: string;
  bytes: number;
  uploadedAt: string;
}

/**
 * A normalized transport failure.
 *
 * `conflict` is separated from the rest because it is the one failure the user
 * can do something about, and the action is specific: reload, look at what
 * changed, decide again. Rendering it as "Save failed" alongside a network
 * error would lose that.
 */
export interface ThemeRequestError extends Error {
  status: number;
  code?: string;
  conflict: boolean;
}

/** One branding slot as the editor sees it: server state plus local edit. */
export interface BrandingSlotView extends AdminBrandingSlot {
  /** Object URL for a candidate the user just picked, or `null`. */
  pendingPreviewUrl: string | null;
  /** The candidate's managed file name, once the upload returned. */
  pendingFileName: string | null;
  /** True when the user cleared a slot that currently has a managed asset. */
  pendingCleared: boolean;
  uploading: boolean;
  previewAspect: BrandingPreviewAspect;
  /** What the preview should show right now: the pending edit, else the saved value. */
  displayPath: string | null;
}

/** Which resources have unsaved edits. Kept per resource, never merged. */
export interface ThemeDirtyState {
  appearance: boolean;
  branding: boolean;
  any: boolean;
}

export type ThemeSettingsPhase = "idle" | "loading" | "saving" | "resetting" | "error";

export interface ThemeSettingsStatus {
  phase: ThemeSettingsPhase;
  /** The last completed action, for a transient confirmation. */
  lastAction: "appearance-saved" | "branding-saved" | "reset" | "preset-applied" | null;
  error: ThemeRequestError | null;
  /** True while a conflict is unresolved; clears on a successful refetch. */
  conflict: null | "appearance" | "branding";
}
