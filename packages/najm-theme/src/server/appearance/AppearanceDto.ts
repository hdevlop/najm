// ============================================================================
// najm-theme/server — appearance request schemas
// ============================================================================
//
// Zod stops at the envelope: is there a revision, is there a design-shaped
// object. The design *itself* is validated by `AppearanceValidator`, not here,
// because the two checks are not interchangeable — Zod would have to restate
// the kit's parser, and the CSS-safety rules on top of it, in a second dialect
// that would then drift.
// ============================================================================

import { z } from "zod";

/**
 * Rejected as `expectedRevision` rather than as `revision`: the field names
 * what the *client believed*, and a message that says so is the difference
 * between "you sent a bad number" and "reload, someone else saved".
 */
export const expectedRevisionSchema = z
  .number()
  .int()
  .positive()
  .describe("The revision the client was editing");

export const saveAppearanceDto = z.object({
  expectedRevision: expectedRevisionSchema,
  // Passed through as `unknown` on purpose. Narrowing it here would duplicate
  // the design contract; `pickAppearancePatch` and the validator own it.
  designConfig: z.unknown(),
});

export const resetAppearanceDto = z.object({
  expectedRevision: expectedRevisionSchema,
});

export type SaveAppearanceDto = z.infer<typeof saveAppearanceDto>;
export type ResetAppearanceDto = z.infer<typeof resetAppearanceDto>;
