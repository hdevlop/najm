// ============================================================================
// najm-theme/server — branding request schemas
// ============================================================================

import { z } from "zod";

import { expectedRevisionSchema } from "../appearance/AppearanceDto";

export const saveBrandingDto = z.object({
  expectedRevision: expectedRevisionSchema,
  // Narrowed by `BrandingValidator.parsePatch` against the live registry, which
  // Zod cannot see: the registered slots are configuration, not a compile-time
  // union, and restating them here would be a second list to keep in step.
  slots: z.unknown(),
  /** Candidate uploads to clean up as part of the same action. */
  discardFileNames: z.array(z.string()).max(32).optional(),
});

export const resetBrandingDto = z.object({
  expectedRevision: expectedRevisionSchema,
});

/**
 * Both parameters are re-validated downstream — the slot against the registry,
 * the file name against the managed-asset pattern. This is only the cheap
 * rejection that keeps a 4 KB path out of the service layer.
 */
export const brandingAssetUploadParams = z.object({
  slot: z.string().min(1).max(64),
  fileName: z.string().min(1).max(128),
});

export const brandingAssetParams = z.object({
  fileName: z.string().min(1).max(128),
});

export type SaveBrandingDto = z.infer<typeof saveBrandingDto>;
export type ResetBrandingDto = z.infer<typeof resetBrandingDto>;
export type BrandingAssetUploadParams = z.infer<typeof brandingAssetUploadParams>;
export type BrandingAssetParams = z.infer<typeof brandingAssetParams>;
